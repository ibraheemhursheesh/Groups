import { and, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { db } from "@/index";
import { notificationActors, notifications } from "@/db/schema";
import { newId } from "@/lib/id";
import { userTopic } from "@/lib/realtime";
import { publish } from "./realtime-bus";

export const POST_LIKE = "post_like";

type LikeRef = {
  postId: string;
  actorId: string;
  recipientId: string;
};

/**
 * Folds one like into the recipient's open aggregation group for that post,
 * opening a group if there isn't one. Five people liking a post while the
 * author is away leaves exactly one unread row behind, which is what lets the
 * author come back to "B, C and 3 others" instead of five separate lines.
 */
export async function recordPostLikeNotification({
  postId,
  actorId,
  recipientId,
}: LikeRef): Promise<void> {
  // Liking your own post is not news.
  if (actorId === recipientId) return;

  const now = new Date();

  await db.transaction(async (tx) => {
    // Conflicts only against groups the recipient hasn't read yet — a group
    // they already read stays closed, and this insert opens a fresh one.
    const [group] = await tx
      .insert(notifications)
      .values({
        id: newId(),
        recipientId,
        type: POST_LIKE,
        targetId: postId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          notifications.recipientId,
          notifications.type,
          notifications.targetId,
        ],
        targetWhere: isNull(notifications.readAt),
        set: { updatedAt: now },
      })
      .returning({ id: notifications.id });

    await tx
      .insert(notificationActors)
      .values({
        id: newId(),
        notificationId: group.id,
        actorId,
        createdAt: now,
      })
      // Unliking and liking again moves you to the front of the group rather
      // than counting you a second time.
      .onConflictDoUpdate({
        target: [notificationActors.notificationId, notificationActors.actorId],
        set: { createdAt: now },
      });
  });

  publish(userTopic(recipientId), { kind: "notifications-changed" });
}

/**
 * Takes an actor back out of the recipient's *open* group when they unlike.
 * Groups the recipient already read are left alone — those are history, and
 * rewriting them would make an already-seen notification change under them.
 */
export async function removePostLikeNotification({
  postId,
  actorId,
  recipientId,
}: LikeRef): Promise<void> {
  if (actorId === recipientId) return;

  const openGroups = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.type, POST_LIKE),
        eq(notifications.targetId, postId),
        isNull(notifications.readAt),
      ),
    );

  if (openGroups.length === 0) return;
  const groupIds = openGroups.map((g) => g.id);

  await db.transaction(async (tx) => {
    await tx
      .delete(notificationActors)
      .where(
        and(
          inArray(notificationActors.notificationId, groupIds),
          eq(notificationActors.actorId, actorId),
        ),
      );

    // A group whose last actor just left has nothing left to say.
    await tx.delete(notifications).where(
      and(
        inArray(notifications.id, groupIds),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(notificationActors)
            .where(eq(notificationActors.notificationId, notifications.id)),
        ),
      ),
    );
  });

  publish(userTopic(recipientId), { kind: "notifications-changed" });
}
