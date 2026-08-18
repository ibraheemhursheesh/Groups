"use client";

import { useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Heart, MessageCircle } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { PostImages } from "./post-images";
import { EditPostDialog } from "./edit-post-dialog";
import { ShareDialog } from "./share-dialog";
import { toggleLikePost } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { MentionContent } from "@/components/mention-content";

const TRUNCATE_LENGTH = 300;

type Post = {
  id: string;
  userId: string;
  userName: string | null;
  userHandle: string | null;
  userImage: string | null;
  content: string;
  images: string[];
  likeCount: number;
  hasLiked: boolean;
  originalPostId: string | null;
  origContent: string | null;
  origImages: string[] | null;
  origUserName: string | null;
  origUserImage: string | null;
  origCreatedAt: Date | null;
  createdAt: Date;
};

export function PostList({
  posts,
  currentUserId,
  isAdmin,
  groupId,
  onDelete,
  onEdit,
  onShare,
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
  onShare: (formData: FormData) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [likeStates, setLikeStates] = useState<Map<string, { liked: boolean; count: number }>>(new Map());
  const likeStatesRef = useRef(likeStates);
  likeStatesRef.current = likeStates;

  const virtualizer = useWindowVirtualizer({
    count: posts.length,
    estimateSize: () => 300,
    overscan: 3,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    getItemKey: (index) => posts[index].id,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItemIndex = virtualItems[virtualItems.length - 1]?.index;

  useEffect(() => {
    if (lastVirtualItemIndex === undefined) return;
    if (!hasMore || loadingMore) return;
    if (lastVirtualItemIndex >= posts.length - 3) {
      onLoadMore?.();
    }
  }, [lastVirtualItemIndex, hasMore, loadingMore, posts.length, onLoadMore]);

  const handleLike = (post: Post) => {
    const optimistic = likeStatesRef.current.get(post.id);
    const liked = optimistic?.liked ?? post.hasLiked;
    const currentCount = optimistic?.count ?? post.likeCount;

    setLikeStates((prev) => {
      const next = new Map(prev);
      next.set(post.id, {
        liked: !liked,
        count: liked ? currentCount - 1 : currentCount + 1,
      });
      return next;
    });
    toggleLikePost(post.id);
  };

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
    <div>
      <div ref={listRef}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const post = posts[virtualItem.index];
            const truncated =
              post.content.length > TRUNCATE_LENGTH && !expanded.has(post.id);
            const displayContent = truncated
              ? post.content.slice(0, TRUNCATE_LENGTH) + "..."
              : post.content;
            const isOwner = post.userId === currentUserId;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <div className="pb-3">
                  <div
                    className="overflow-hidden rounded-xl border cursor-pointer transition hover:border-primary/30"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button, a, [role='menu'], [role='dialog']")) return;
                      router.push(`/groups/${groupId}/post/${post.id}`);
                    }}
                  >
                    <div className="flex items-center justify-between px-4 pt-4">
                      <div className="flex items-center gap-2">
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
                          {post.userHandle ? (
                            <a
                              href={`/profile/${post.userHandle}`}
                              className="text-sm font-medium hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {post.userName || post.userId}
                            </a>
                          ) : (
                            <span className="text-sm font-medium">{post.userName || post.userId}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {post.userHandle && `@${post.userHandle} · `}{timeAgo(new Date(post.createdAt))}
                          </span>
                        </div>
                      </div>

                      {(isAdmin || isOwner) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="xs">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
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

                    {post.originalPostId ? (
                      <>
                        {post.content && (
                          <p className="px-4 pt-2 text-sm whitespace-pre-wrap"><MentionContent content={post.content} /></p>
                        )}
                        <div className="mx-4 mb-3 mt-2 rounded-lg border bg-muted/30 p-3">
                          {post.origContent !== null ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                {post.origUserImage ? (
                                  <img src={post.origUserImage} alt="" className="h-10 w-10 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                                    {(post.origUserName || "").charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {post.origUserName} · {post.origCreatedAt ? timeAgo(new Date(post.origCreatedAt)) : ""}
                                </span>
                              </div>
                              {post.origContent && (
                                <p className="text-sm whitespace-pre-wrap"><MentionContent content={post.origContent} /></p>
                              )}
                              {post.origImages && post.origImages.length > 0 && (
                                <div className="mt-2">
                                  <PostImages images={post.origImages} />
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              This post has been deleted.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        {post.content && (
                          <p className="px-4 pb-4 pt-2 text-sm whitespace-pre-wrap">
                            <MentionContent content={displayContent} />
                            {post.content.length > TRUNCATE_LENGTH && (
                              <button
                                onClick={() => toggleExpand(post.id)}
                                className="ml-1 text-primary hover:underline"
                              >
                                {truncated ? "Read more" : "Show less"}
                              </button>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    <PostImages images={post.images} />

                    <div className="flex items-center gap-4 px-4 pb-3 pt-2 text-muted-foreground justify-evenly">
                      <button
                        onClick={() => handleLike(post)}
                        className="py-2 px-5 flex items-center gap-1.5 text-xs transition hover:text-red-500 hover:bg-red-100 rounded-md"
                      >
                        <Heart
                          className={`size-4 ${
                            (likeStates.get(post.id)?.liked ?? post.hasLiked)
                              ? "fill-red-500 text-red-500"
                              : ""
                          }`}
                        />
                        {(likeStates.get(post.id)?.count ?? post.likeCount) > 0 && (
                          <span>
                            {likeStates.get(post.id)?.count ?? post.likeCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => router.push(`/groups/${groupId}/post/${post.id}`)}
                        className="py-2 px-5 flex items-center gap-1.5 text-xs transition hover:text-blue-500 hover:bg-blue-100 rounded-md"
                      >
                        <MessageCircle className="size-4" />
                      </button>
                      <ShareDialog
                        originalPostId={post.originalPostId || post.id}
                        originalPost={post.originalPostId ? {
                          userName: post.origUserName ?? post.userName,
                          userImage: post.origUserImage ?? post.userImage,
                          content: post.origContent ?? post.content,
                          images: post.origImages ?? post.images,
                          createdAt: post.origCreatedAt ?? post.createdAt,
                        } : {
                          userName: post.userName,
                          userImage: post.userImage,
                          content: post.content,
                          images: post.images,
                          createdAt: post.createdAt,
                        }}
                        groupId={groupId}
                        onShare={onShare}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

      {hasMore && loadingMore && (
        <div className="flex justify-center py-4">
          <p className="text-xs text-muted-foreground">Loading more...</p>
        </div>
      )}
    </div>
  );
}
