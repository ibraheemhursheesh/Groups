import { getPost, getComments } from "@/app/actions/comments";
import { auth } from "@/app/lib/auth";
import { requireConfirmedHandle } from "@/app/lib/require-handle";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PostPageClient } from "./post-page-client";
import { db } from "@/index";
import { likes, posts, user } from "@/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string; postId: string }>;
}) {
  const { id: groupId, postId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  requireConfirmedHandle(session);

  const post = await getPost(postId);
  if (!post || post.groupId !== groupId) notFound();

  const [likeCountResult] = await db
    .select({ count: count() })
    .from(likes)
    .where(eq(likes.postId, postId));

  const [userLike] = await db
    .select()
    .from(likes)
    .where(and(eq(likes.postId, postId), eq(likes.userId, session.user.id)));

  let origPost = null;
  if (post.originalPostId) {
    const [orig] = await db
      .select({
        id: posts.id,
        content: posts.content,
        images: posts.images,
        createdAt: posts.createdAt,
        userName: user.name,
        userImage: user.image,
      })
      .from(posts)
      .leftJoin(user, eq(posts.userId, user.id))
      .where(eq(posts.id, post.originalPostId));

    if (orig) {
      const parseImages = (images: unknown): string[] => {
        if (!images) return [];
        if (Array.isArray(images)) return images;
        try { return JSON.parse(images as string); } catch { return []; }
      };
      origPost = { ...orig, images: parseImages(orig.images) };
    }
  }

  const commentsList = await getComments(postId);

  const [currentUserProfile] = await db
    .select({ image: user.image, name: user.name, handle: user.handle })
    .from(user)
    .where(eq(user.id, session.user.id));

  return (
    <PostPageClient
      groupId={groupId}
      post={{
        ...post,
        likeCount: Number(likeCountResult?.count ?? 0),
        hasLiked: !!userLike,
        originalPostId: post.originalPostId,
        origContent: origPost?.content ?? null,
        origImages: origPost?.images ?? null,
        origUserName: origPost?.userName ?? null,
        origUserImage: origPost?.userImage ?? null,
        origCreatedAt: origPost?.createdAt ?? null,
      }}
      initialComments={commentsList}
      currentUserId={session.user.id}
      currentUserName={currentUserProfile?.name ?? null}
      currentUserHandle={currentUserProfile?.handle ?? null}
      currentUserImage={currentUserProfile?.image ?? null}
    />
  );
}
