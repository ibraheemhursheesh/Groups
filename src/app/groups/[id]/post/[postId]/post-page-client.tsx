"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Heart, MessageCircle } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { PostImages } from "../../post-images";
import { toggleLikePost } from "@/app/actions/groups";
import { createComment } from "@/app/actions/comments";
import { CommentList } from "./comment-list";
import Link from "next/link";
import { MentionContent } from "@/components/mention-content";

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
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <Link
        href={`/groups/${groupId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="">
        <div className="flex items-center gap-2 px-4 pt-4">
          {post.userImage ? (
            <img
              src={post.userImage}
              alt={post.userName || ""}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
              {(post.userName || post.userId).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            {post.userHandle ? (
              <a
                href={`/profile/${post.userHandle}`}
                className="text-sm font-medium hover:underline"
              >
                {post.userName || post.userId}
              </a>
            ) : (
              <span className="text-sm font-medium">
                {post.userName || post.userId}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {post.userHandle && `@${post.userHandle} · `}
              {timeAgo(new Date(post.createdAt))}
            </span>
          </div>
        </div>

        {post.originalPostId ? (
          <>
            {post.content && (
              <p className="px-4 pt-3 text-sm whitespace-pre-wrap">
                <MentionContent content={post.content} />
              </p>
            )}
            <div className="mx-4 mb-3 mt-2 rounded-lg border bg-muted/30 p-3">
              {post.origContent !== null ? (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    {post.origUserImage ? (
                      <img
                        src={post.origUserImage}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                        {(post.origUserName || "").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {post.origUserName} ·{" "}
                      {post.origCreatedAt
                        ? timeAgo(new Date(post.origCreatedAt))
                        : ""}
                    </span>
                  </div>
                  {post.origContent && (
                    <p className="text-sm whitespace-pre-wrap">
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
          <>
            {post.content && (
              <p className="px-4 pb-4 pt-3 text-sm md:text-base whitespace-pre-wrap">
                <MentionContent content={post.content} />
              </p>
            )}
          </>
        )}

        <PostImages images={post.images} />

        <div className="flex items-center gap-4 border-b px-4 pb-3 pt-2 text-muted-foreground">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition hover:bg-red-100 hover:text-red-500"
          >
            <Heart
              className={`size-4 ${liked ? "fill-red-500 text-red-500" : ""}`}
            />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            <MessageCircle className="size-4" />
            {commentsList.length > 0 && <span>{commentsList.length}</span>}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-4 text-sm font-semibold">Comments</h3>
        {commentsList.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No comments yet.
          </p>
        ) : (
          <CommentList
            comments={commentsList}
            currentUserId={currentUserId}
            onReply={handleReply}
            newRepliesMap={newRepliesMap}
          />
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {currentUserImage ? (
            <img
              src={currentUserImage}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
              {(currentUserName || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {replyingTo && (
              <div className="flex items-center gap-1 px-1 pb-1 text-xs text-muted-foreground">
                <span>Replying to {replyingTo.userName}</span>
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
                  : "Write a comment..."
              }
              className="h-10 w-full rounded-full border bg-muted/50 px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
