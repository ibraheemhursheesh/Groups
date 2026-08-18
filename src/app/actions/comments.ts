"use server";

import { auth } from "@/app/lib/auth";
import { db } from "@/index";
import { comments, commentLikes, posts, user } from "@/db/schema";
import { eq, and, desc, count, isNull, inArray } from "drizzle-orm";
import { headers } from "next/headers";

export async function getPost(postId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  const [post] = await db
    .select({
      id: posts.id,
      groupId: posts.groupId,
      userId: posts.userId,
      userName: user.name,
      userHandle: user.handle,
      userImage: user.image,
      content: posts.content,
      images: posts.images,
      createdAt: posts.createdAt,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .leftJoin(user, eq(posts.userId, user.id))
    .where(eq(posts.id, postId));

  if (!post) return null;

  const parseImages = (images: unknown): string[] => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    try {
      return JSON.parse(images as string);
    } catch {
      return [];
    }
  };

  return { ...post, images: parseImages(post.images) };
}

export async function getComments(postId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  const topLevel = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      userName: user.name,
      userHandle: user.handle,
      userImage: user.image,
      content: comments.content,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(user, eq(comments.userId, user.id))
    .where(and(eq(comments.postId, postId), isNull(comments.parentId)))
    .orderBy(desc(comments.createdAt));

  const commentIds = topLevel.map((c) => c.id);

  const [likeCounts, userLikes, replyCounts] = await Promise.all([
    commentIds.length > 0
      ? db
          .select({ commentId: commentLikes.commentId, count: count() })
          .from(commentLikes)
          .where(inArray(commentLikes.commentId, commentIds))
          .groupBy(commentLikes.commentId)
      : [],
    commentIds.length > 0
      ? db
          .select({ commentId: commentLikes.commentId })
          .from(commentLikes)
          .where(
            and(
              eq(commentLikes.userId, session.user.id),
              inArray(commentLikes.commentId, commentIds),
            ),
          )
      : [],
    commentIds.length > 0
      ? db
          .select({ parentId: comments.parentId, count: count() })
          .from(comments)
          .where(inArray(comments.parentId, commentIds))
          .groupBy(comments.parentId)
      : [],
  ]);

  const likeCountMap = new Map(
    likeCounts.map((l) => [l.commentId, Number(l.count)]),
  );
  console.log(likeCountMap);
  const userLikeSet = new Set(userLikes.map((l) => l.commentId));
  console.log("userLIkes:", userLikes);
  console.log("userLikeSet:", userLikeSet);
  const replyCountMap = new Map(
    replyCounts.map((r) => [r.parentId!, Number(r.count)]),
  );

  return topLevel.map((c) => ({
    ...c,
    likeCount: likeCountMap.get(c.id) ?? 0,
    hasLiked: userLikeSet.has(c.id),
    replyCount: replyCountMap.get(c.id) ?? 0,
  }));
}

export async function getReplies(parentId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  const replies = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      userName: user.name,
      userHandle: user.handle,
      userImage: user.image,
      content: comments.content,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(user, eq(comments.userId, user.id))
    .where(eq(comments.parentId, parentId))
    .orderBy(comments.createdAt);

  const replyIds = replies.map((r) => r.id);

  const [likeCounts, userLikes] = await Promise.all([
    replyIds.length > 0
      ? db
          .select({ commentId: commentLikes.commentId, count: count() })
          .from(commentLikes)
          .where(inArray(commentLikes.commentId, replyIds))
          .groupBy(commentLikes.commentId)
      : [],
    replyIds.length > 0
      ? db
          .select({ commentId: commentLikes.commentId })
          .from(commentLikes)
          .where(
            and(
              eq(commentLikes.userId, session.user.id),
              inArray(commentLikes.commentId, replyIds),
            ),
          )
      : [],
  ]);

  const likeCountMap = new Map(
    likeCounts.map((l) => [l.commentId, Number(l.count)]),
  );
  const userLikeSet = new Set(userLikes.map((l) => l.commentId));

  return replies.map((r) => ({
    ...r,
    likeCount: likeCountMap.get(r.id) ?? 0,
    hasLiked: userLikeSet.has(r.id),
    replyCount: 0,
  }));
}

export async function createComment(
  postId: string,
  content: string,
  parentId?: string,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  if (!content.trim()) throw new Error("Comment cannot be empty");

  let resolvedParentId = parentId || null;
  if (resolvedParentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId })
      .from(comments)
      .where(eq(comments.id, resolvedParentId));
    if (parent?.parentId) {
      resolvedParentId = parent.parentId;
    }
  }

  const id = crypto
    .getRandomValues(new Uint8Array(16))
    .reduce(
      (s, b, i) =>
        s +
        (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
        b.toString(16).padStart(2, "0"),
      "",
    );
  await db.insert(comments).values({
    id,
    postId,
    userId: session.user.id,
    content: content.trim(),
    parentId: resolvedParentId,
    createdAt: new Date(),
  });

  const [inserted] = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      userName: user.name,
      userHandle: user.handle,
      userImage: user.image,
      content: comments.content,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(user, eq(comments.userId, user.id))
    .where(eq(comments.id, id));

  return { ...inserted, likeCount: 0, hasLiked: false, replyCount: 0 };
}

export async function toggleLikeComment(commentId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  const userId = session.user.id;

  // Atomic toggle — no read-then-write window. The DELETE either claims the
  // existing row or reports none (Postgres serializes concurrent deletes on the
  // row lock), and the INSERT cannot duplicate thanks to the unique index on
  // (comment_id, user_id).
  const deleted = await db
    .delete(commentLikes)
    .where(
      and(
        eq(commentLikes.commentId, commentId),
        eq(commentLikes.userId, userId),
      ),
    )
    .returning({ id: commentLikes.id });

  let liked: boolean;
  if (deleted.length > 0) {
    liked = false;
  } else {
    await db
      .insert(commentLikes)
      .values({
        id: crypto
          .getRandomValues(new Uint8Array(16))
          .reduce(
            (s, b, i) =>
              s +
              (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
              b.toString(16).padStart(2, "0"),
            "",
          ),
        commentId,
        userId,
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [commentLikes.commentId, commentLikes.userId],
      });
    // Either we inserted, or a concurrent request beat us to it. Either way a
    // like row now exists for this user.
    liked = true;
  }

  const [result] = await db
    .select({ count: count() })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, commentId));

  return { liked, likeCount: Number(result?.count ?? 0) };
}
