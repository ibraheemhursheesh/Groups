//  @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { PostImages } from "./post-images";

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
  onDelete,
  onEdit,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  posts: Post[];
  currentUserId: string;
  isAdmin: boolean;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

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
      <p className="py-8 text-center text-sm text-muted-foreground">
        No posts yet.
      </p>
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

  const startEditing = (post: Post) => {
    setEditing(post.id);
    setEditContent(post.content);
  };

  const cancelEditing = () => {
    setEditing(null);
    setEditContent("");
  };

  const saveEdit = async (postId: string) => {
    if (editContent.trim().length === 0) return;
    onEdit(postId, editContent.trim());
    setEditing(null);
    setEditContent("");
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
                    {post.userName || post.userId}{" "}
                    {new Date(post.createdAt).toLocaleDateString()}
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
                        <DropdownMenuItem onClick={() => startEditing(post)}>
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

              {editing === post.id ? (
                <div className="px-4 pb-4 pt-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="mb-2"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(post.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="px-4 pb-4 pt-2 text-sm whitespace-pre-wrap">
                  {displayContent}
                  {post.content.length > TRUNCATE_LENGTH && (
                    <button
                      onClick={() => toggleExpand(post.id)}
                      className="ml-1 text-indigo-600 hover:underline"
                    >
                      {truncated ? "Read more" : "Show less"}
                    </button>
                  )}
                </p>
              )}

              <PostImages images={post.images} />
            </li>
          );
        })}
      </ul>

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
