"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Heart, MessageCircle, Share2 } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { PostImages } from "./post-images";
import { EditPostDialog } from "./edit-post-dialog";

const TRUNCATE_LENGTH = 300;

type Post = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  content: string;
  images: string[];
  createdAt: Date;
};

export function PostList({
  posts,
  currentUserId,
  isAdmin,
  groupId,
  onDelete,
  onEdit,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  posts: Post[];
  currentUserId: string;
  isAdmin: boolean;
  groupId: string;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, groupId: string, content: string, existingUrls: string[], newFiles: File[]) => Promise<void>;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore?.();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (posts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No posts yet.</p>
    );
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Posts</h3>
      <ul className="space-y-3">
        {posts.map((post) => {
          const truncated =
            post.content.length > TRUNCATE_LENGTH && !expanded.has(post.id);
          const displayContent = truncated
            ? post.content.slice(0, TRUNCATE_LENGTH) + "..."
            : post.content;
          const isOwner = post.userId === currentUserId;

          return (
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
                    {post.userName || post.userId} · {timeAgo(new Date(post.createdAt))}
                  </span>
                </div>

                {(isAdmin || isOwner) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="xs">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {isOwner && (
                        <DropdownMenuItem onClick={() => setEditingPost(post)}>
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onDelete(post.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <p className="px-4 pb-4 pt-2 text-sm whitespace-pre-wrap">
                {displayContent}
                {post.content.length > TRUNCATE_LENGTH && (
                  <button
                    onClick={() => toggleExpand(post.id)}
                    className="ml-1 text-primary hover:underline"
                  >
                    {truncated ? "Read more" : "Show less"}
                  </button>
                )}
              </p>

              <PostImages images={post.images} />

              <div className="flex items-center gap-4 px-4 pb-3 pt-2 text-muted-foreground justify-evenly">
                <button className="flex items-center gap-1.5 text-xs transition hover:text-red-500">
                  <Heart className="size-4" />
                </button>
                <button className="flex items-center gap-1.5 text-xs transition hover:text-blue-500">
                  <MessageCircle className="size-4" />
                </button>
                <button className="flex items-center gap-1.5 text-xs transition hover:text-green-500">
                  <Share2 className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {editingPost && (
        <EditPostDialog
          open
          onOpenChange={() => setEditingPost(null)}
          postId={editingPost.id}
          groupId={groupId}
          initialContent={editingPost.content}
          initialImages={editingPost.images}
          onSave={onEdit}
        />
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && <p className="text-xs text-muted-foreground">Loading more...</p>}
        </div>
      )}
    </div>
  );
}
