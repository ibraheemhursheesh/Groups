"use client";

import { useState, useTransition } from "react";
import { timeAgo } from "@/lib/utils";
import { newId } from "@/lib/id";
import { Button } from "@/components/ui/button";
import { MentionContent } from "@/components/mention-content";
import { LinkPreviewCard } from "@/components/link-preview-card";
import { parseLinkPreview } from "@/lib/links";
import { PostImages } from "@/app/groups/[id]/post-images";
import {
  createProfilePost,
  getProfilePosts,
  type ProfilePost,
} from "@/app/actions/profile-posts";
import { ProfilePostComposer } from "./profile-post-composer";

type Author = {
  id: string;
  name: string;
  handle: string;
  image: string | null;
};

// A post that is on screen but not yet in the database. Its images are still
// local blob urls, which `next/image` cannot load — so they render through a
// plain <img> until the server hands back the uploaded urls.
type FeedPost = ProfilePost & { pending?: boolean };

export function ProfileFeed({
  author,
  isOwner,
  initialPosts,
  initialNextCursor,
}: {
  author: Author;
  isOwner: boolean;
  initialPosts: ProfilePost[];
  initialNextCursor: string | null;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [cursor, setCursor] = useState(initialNextCursor);
  const [loadingMore, startLoadMore] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    // Display only — the stored card is whatever the server fetches for
    // `previewUrl`, never what the client hands it.
    const optimisticPreview = parseLinkPreview(formData.get("previewData"));
    formData.delete("previewData");

    const previewUrls = JSON.parse(
      (formData.get("previewUrls") as string) || "[]",
    ) as string[];
    formData.delete("previewUrls");

    const optimisticId = `optimistic-${newId()}`;
    setError(null);
    setPosts((prev) => [
      {
        id: optimisticId,
        userId: author.id,
        userName: author.name,
        userHandle: author.handle,
        userImage: author.image,
        content: ((formData.get("content") as string) || "").trim(),
        images: previewUrls,
        linkPreview: optimisticPreview,
        createdAt: new Date(),
        pending: true,
      },
      ...prev,
    ]);

    createProfilePost(formData)
      .then((created) => {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        setPosts((prev) =>
          prev.map((p) =>
            p.id === optimisticId
            ? {
                ...p,
                id: created.id,
                images: created.images,
                linkPreview: created.linkPreview,
                pending: false,
              }
              : p,
          ),
        );
      })
      .catch((err) => {
        // The post never landed, so the optimistic copy has to go with it —
        // leaving it on screen would claim a post that does not exist.
        console.error("failed to create profile post", err);
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        setPosts((prev) => prev.filter((p) => p.id !== optimisticId));
        setError("Could not publish your post. Please try again.");
      });
  };

  const handleLoadMore = () => {
    if (!cursor) return;
    startLoadMore(async () => {
      const result = await getProfilePosts(author.handle, cursor);
      setPosts((prev) => [...prev, ...result.posts]);
      setCursor(result.nextCursor);
    });
  };

  return (
    // Room at the bottom so the sticky composer button never covers the last post.
    <section className={isOwner ? "mt-8 pb-20" : "mt-8"}>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Posts</h2>

      {error && (
        <p className="mb-3 text-xs text-destructive">{error}</p>
      )}

      {posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {isOwner ? "You haven't posted yet." : "No posts yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="overflow-hidden rounded-xl border"
            >
              <div className="flex items-center gap-2 px-4 pt-4">
                {post.userImage ? (
                  <img
                    src={post.userImage}
                    alt={post.userName || ""}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    {(post.userName || post.userId).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {post.userName || post.userId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {post.userHandle && `@${post.userHandle} · `}
                    {post.pending ? "Posting..." : timeAgo(new Date(post.createdAt))}
                  </span>
                </div>
              </div>

              {post.content && (
                <p className="whitespace-pre-wrap px-4 pb-4 pt-2 text-sm">
                  <MentionContent content={post.content} />
                </p>
              )}

              {post.pending ? (
                post.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-0.5">
                    {post.images.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                    ))}
                  </div>
                )
              ) : (
                <PostImages images={post.images} />
              )}

              {post.linkPreview && (
                <LinkPreviewCard preview={post.linkPreview} className="mx-4 mb-3" />
              )}
            </article>
          ))}
        </div>
      )}

      {cursor && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}

      {isOwner && <ProfilePostComposer onOptimisticSubmit={handleSubmit} />}
    </section>
  );
}
