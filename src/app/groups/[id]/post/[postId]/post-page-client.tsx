"use client";

import { useCallback, useState, useRef } from "react";
import { ArrowLeft, Heart, MessageCircle, Repeat2, Bookmark, Share, MoreHorizontal } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { PostImages } from "../../post-images";
import { toggleLikePost } from "@/app/actions/groups";
import { createComment } from "@/app/actions/comments";
import { CommentList } from "./comment-list";
import Link from "next/link";
import { MentionContent } from "@/components/mention-content";
import { LinkPreviewCard } from "@/components/link-preview-card";
import type { LinkPreview } from "@/lib/links";
import { useRealtimeEvents } from "@/components/realtime-provider";

type Comment = {
  id: string;
  postId: string;
  userId: string;
  userName: string | null;
  userHandle: string | null;
  userImage: string | null;
  content: string;
  parentId: string | null;
  createdAt: Date;
  likeCount: number;
  hasLiked: boolean;
  replyCount: number;
};

type Post = {
  id: string;
  groupId: string;
  userId: string;
  userName: string | null;
  userHandle: string | null;
  userImage: string | null;
  content: string;
  images: string[];
  linkPreview: LinkPreview | null;
  createdAt: Date;
  likeCount: number;
  hasLiked: boolean;
  originalPostId: string | null;
  origContent: string | null;
  origImages: string[] | null;
  origUserName: string | null;
  origUserImage: string | null;
  origCreatedAt: Date | null;
};

function formatFullDate(date: Date) {
  const d = new Date(date);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${h}:${minutes} ${ampm} · ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function PostPageClient({
  groupId,
  post,
  initialComments,
  currentUserId,
  currentUserName,
  currentUserHandle,
  currentUserImage,
}: {
  groupId: string;
  post: Post;
  initialComments: Comment[];
  currentUserId: string;
  currentUserName: string | null;
  currentUserHandle: string | null;
  currentUserImage: string | null;
}) {
  const [liked, setLiked] = useState(post.hasLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentsList, setCommentsList] = useState(initialComments);
  const [newRepliesMap, setNewRepliesMap] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live count for this one post; `liked` stays local because it is personal.
  useRealtimeEvents(
    useCallback(
      (event) => {
        if (event.kind !== "post-like" || event.postId !== post.id) return;
        setLikeCount(event.likeCount);
      },
      [post.id],
    ),
  );

  const handleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    toggleLikePost(post.id);
  };

  const handleSubmitComment = () => {
    const text = commentText.trim();
    if (!text) return;

    const parentId = replyingTo?.id || undefined;
    const optimisticId = `optimistic-${crypto
      .getRandomValues(new Uint8Array(16))
      .reduce(
        (s, b, i) =>
          s +
          (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
          b.toString(16).padStart(2, "0"),
        "",
      )}`;
    const optimistic: Comment = {
      id: optimisticId,
      postId: post.id,
      userId: currentUserId,
      userName: currentUserName,
      userHandle: currentUserHandle,
      userImage: currentUserImage,
      content: text,
      parentId: parentId || null,
      createdAt: new Date(),
      likeCount: 0,
      hasLiked: false,
      replyCount: 0,
    };

    if (parentId) {
      setNewRepliesMap((prev) => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), optimistic],
      }));
      setCommentsList((prev) =>
        prev.map((c) =>
          c.id === parentId ? { ...c, replyCount: c.replyCount + 1 } : c,
        ),
      );
    } else {
      setCommentsList((prev) => [optimistic, ...prev]);
    }

    setCommentText("");
    setReplyingTo(null);

    createComment(post.id, text, parentId).then((real) => {
      if (parentId) {
        setNewRepliesMap((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).map((r) =>
            r.id === optimisticId ? { ...(real as Comment), replyCount: 0 } : r,
          ),
        }));
      } else {
        setCommentsList((prev) =>
          prev.map((c) =>
            c.id === optimisticId ? { ...(real as Comment) } : c,
          ),
        );
      }
    });
  };

  const handleReply = (commentId: string, userName: string) => {
    setReplyingTo({ id: commentId, userName });
    inputRef.current?.focus();
  };

  return (
    <main className="mx-auto max-w-2xl pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Link
          href={`/groups/${groupId}`}
          className="rounded-full p-1.5 transition hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">Post</h1>
      </div>

      {/* Author */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {post.userImage ? (
            <img
              src={post.userImage}
              alt={post.userName || ""}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {(post.userName || post.userId).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            {post.userHandle ? (
              <a
                href={`/profile/${post.userHandle}`}
                className="text-[15px] font-bold leading-tight hover:underline"
              >
                {post.userName || post.userId}
              </a>
            ) : (
              <span className="text-[15px] font-bold leading-tight">
                {post.userName || post.userId}
              </span>
            )}
            {post.userHandle && (
              <span className="text-sm text-muted-foreground">
                @{post.userHandle}
              </span>
            )}
          </div>
        </div>
        <button className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {/* Content */}
      {post.originalPostId ? (
        <>
          {post.content && (
            <div className="px-4 pt-1 pb-2 text-[15px] leading-relaxed whitespace-pre-wrap">
              <MentionContent content={post.content} />
            </div>
          )}
          <div className="mx-4 mb-3 rounded-xl border p-3">
            {post.origContent !== null ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  {post.origUserImage ? (
                    <img
                      src={post.origUserImage}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                      {(post.origUserName || "").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium">
                    {post.origUserName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {post.origCreatedAt ? timeAgo(new Date(post.origCreatedAt)) : ""}
                  </span>
                </div>
                {post.origContent && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    <MentionContent content={post.origContent} />
                  </p>
                )}
                {post.origImages && post.origImages.length > 0 && (
                  <div className="mt-2">
                    <PostImages images={post.origImages} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                This post has been deleted.
              </p>
            )}
          </div>
        </>
      ) : (
        post.content && (
          <div className="px-4 pt-1 pb-3 text-[15px] md:text-base leading-relaxed whitespace-pre-wrap">
            <MentionContent content={post.content} />
          </div>
        )
      )}

      <PostImages images={post.images} />

      {post.linkPreview && (
        <LinkPreviewCard preview={post.linkPreview} className="mt-3" />
      )}

      {/* Timestamp */}
      <div className="border-b px-4 pb-3 pt-2">
        <span className="text-sm text-muted-foreground">
          {formatFullDate(new Date(post.createdAt))}
        </span>
      </div>

      {/* Stats row */}
      {(likeCount > 0 || commentsList.length > 0) && (
        <div className="flex items-center gap-4 border-b px-4 py-3">
          {commentsList.length > 0 && (
            <span className="text-sm">
              <span className="font-bold">{commentsList.length}</span>{" "}
              <span className="text-muted-foreground">
                {commentsList.length === 1 ? "reply" : "replies"}
              </span>
            </span>
          )}
          {likeCount > 0 && (
            <span className="text-sm">
              <span className="font-bold">{likeCount}</span>{" "}
              <span className="text-muted-foreground">
                {likeCount === 1 ? "like" : "likes"}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-around border-b px-4 py-2">
        <button
          className="rounded-full p-2 text-muted-foreground transition hover:bg-blue-500/10 hover:text-blue-500"
          onClick={() => inputRef.current?.focus()}
        >
          <MessageCircle className="size-5" />
        </button>
        <button className="rounded-full p-2 text-muted-foreground transition hover:bg-green-500/10 hover:text-green-500">
          <Repeat2 className="size-5" />
        </button>
        <button
          onClick={handleLike}
          className={`rounded-full p-2 transition hover:bg-red-500/10 hover:text-red-500 ${
            liked ? "text-red-500" : "text-muted-foreground"
          }`}
        >
          <Heart className={`size-5 ${liked ? "fill-red-500" : ""}`} />
        </button>
        <button className="rounded-full p-2 text-muted-foreground transition hover:bg-blue-500/10 hover:text-blue-500">
          <Share className="size-5" />
        </button>
      </div>

      {/* Reply input */}
      <div className="flex items-start gap-3 border-b px-4 py-3">
        {currentUserImage ? (
          <img
            src={currentUserImage}
            alt=""
            className="mt-1 h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {(currentUserName || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {replyingTo && (
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <span>Replying to <span className="text-primary">@{replyingTo.userName}</span></span>
              <button
                onClick={() => setReplyingTo(null)}
                className="ml-1 font-medium hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            placeholder={
              replyingTo
                ? `Reply to ${replyingTo.userName}...`
                : "Write your reply"
            }
            className="h-10 w-full rounded-full border bg-transparent px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Replies */}
      {commentsList.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No replies yet.
        </p>
      ) : (
        <div className="px-4 pt-3">
          <CommentList
            comments={commentsList}
            currentUserId={currentUserId}
            onReply={handleReply}
            newRepliesMap={newRepliesMap}
          />
        </div>
      )}
    </main>
  );
}
