"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

type Post = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
};

export function PostList({
  posts,
  currentUserId,
  isAdmin,
  onDelete,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  posts: Post[];
  currentUserId: string;
  isAdmin: boolean;
  onDelete: (postId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore?.();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (posts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No posts yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Posts</h3>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="flex items-center gap-2">
                {post.userImage ? (
                  <img
                    src={post.userImage}
                    alt={post.userName || ""}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    {(post.userName || post.userId).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {post.userName || post.userId}{" "}
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
              {(isAdmin || post.userId === currentUserId) && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onDelete(post.id)}
                >
                  Delete
                </Button>
              )}
            </div>
            <p className="px-4 pb-4 pt-2 text-sm whitespace-pre-wrap">
              {post.content}
            </p>
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt="Post image"
                className="w-full object-cover"
              />
            )}
          </li>
        ))}
      </ul>

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && (
            <p className="text-xs text-muted-foreground">Loading more...</p>
          )}
        </div>
      )}
    </div>
  );
}