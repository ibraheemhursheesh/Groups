"use server";

import { headers } from "next/headers";
import { and, count, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/index";
import { notificationActors, notifications, posts, user } from "@/db/schema";
import { auth } from "@/app/lib/auth";
import { POST_LIKE } from "@/app/lib/notifications";
import { publish } from "@/app/lib/realtime-bus";
import { userTopic } from "@/lib/realtime";
import { describePostLike, MAX_NAMED_ACTORS } from "@/lib/notifications-format";

const FEED_LIMIT = 20;
const PREVIEW_LENGTH = 90;

export type NotificationItem = {
  id: string;
  type: string;
  text: string;
  postId: string;
  groupId: string;
  postPreview: string;
  actorImages: (string | null)[];
  actorCount: number;
  read: boolean;
  updatedAt: Date;
};

export type NotificationFeed = {
  items: NotificationItem[];
  unreadCount: number;
};

/**
 * The recipient's aggregation groups, newest activity first, already collapsed
 * into display text. This is the only way notification content reaches the
 * browser — the SSE channel just says "re-read me".
 */
export async function getNotifications(): Promise<NotificationFeed> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { items: [], unreadCount: 0 };

  const recipientId = session.user.id;

  // Joining posts does double duty: it supplies the preview and it drops groups
  // whose post has since been deleted, so a dead group can't occupy one of the
  // feed's slots. Every notification type targets a post today; a type that
  // targets something else will need this join split per type.
  const [groups, [unread]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        targetId: notifications.targetId,
        updatedAt: notifications.updatedAt,
        readAt: notifications.readAt,
        postContent: posts.content,
        postGroupId: posts.groupId,
      })
      .from(notifications)
      .innerJoin(posts, eq(posts.id, notifications.targetId))
      .where(eq(notifications.recipientId, recipientId))
      .orderBy(desc(notifications.updatedAt))
      .limit(FEED_LIMIT),
    db
      .select({ value: count() })
      .from(notifications)
      .innerJoin(posts, eq(posts.id, notifications.targetId))
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
        ),
      ),
  ]);

  if (groups.length === 0) {
    return { items: [], unreadCount: 0 };
  }

  const groupIds = groups.map((g) => g.id);

  // One pass over the actors: `row_number` picks the few we name, and the
  // `count(*)` window carries the group's real size so "and N others" is right
  // without a second aggregate query.
  const ranked = db.$with("ranked_actors").as(
    db
      .select({
        notificationId: notificationActors.notificationId,
        name: user.name,
        image: user.image,
        rank: sql<string>`row_number() over (
          partition by ${notificationActors.notificationId}
          order by ${notificationActors.createdAt} desc
        )`.as("rank"),
        total: sql<string>`count(*) over (
          partition by ${notificationActors.notificationId}
        )`.as("total"),
      })
      .from(notificationActors)
      .innerJoin(user, eq(user.id, notificationActors.actorId))
      .where(inArray(notificationActors.notificationId, groupIds)),
  );

  const actorRows = await db
    .with(ranked)
    .select()
    .from(ranked)
    .where(lte(ranked.rank, sql`${MAX_NAMED_ACTORS}`))
    .orderBy(ranked.notificationId, ranked.rank);

  const actorsByGroup = new Map<
    string,
    { names: string[]; images: (string | null)[]; total: number }
  >();
  for (const row of actorRows) {
    let entry = actorsByGroup.get(row.notificationId);
    if (!entry) {
      entry = { names: [], images: [], total: Number(row.total) };
      actorsByGroup.set(row.notificationId, entry);
    }
    entry.names.push(row.name);
    entry.images.push(row.image);
  }

  const items: NotificationItem[] = [];
  for (const group of groups) {
    const actors = actorsByGroup.get(group.id);
    // A group with no actors left is mid-cleanup; nothing to render.
    if (!actors || actors.total === 0) continue;

    const text =
      group.type === POST_LIKE
        ? describePostLike(actors.names, actors.total)
        : "";
    if (!text) continue;

    items.push({
      id: group.id,
      type: group.type,
      text,
      postId: group.targetId,
      groupId: group.postGroupId,
      postPreview:
        group.postContent.length > PREVIEW_LENGTH
          ? `${group.postContent.slice(0, PREVIEW_LENGTH).trimEnd()}…`
          : group.postContent,
      actorImages: actors.images,
      actorCount: actors.total,
      read: group.readAt !== null,
      updatedAt: group.updatedAt,
    });
  }

  return { items, unreadCount: Number(unread?.value ?? 0) };
}

/**
 * Closes every open group. Beyond clearing the badge this is what ends an
 * aggregation window: likes arriving after this point open a new group rather
 * than reviving one the user has already looked at.
 */
export async function markNotificationsRead(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;

  const recipientId = session.user.id;

  const closed = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  // Other tabs are looking at the same badge.
  if (closed.length > 0) {
    publish(userTopic(recipientId), { kind: "notifications-changed" });
  }
}
