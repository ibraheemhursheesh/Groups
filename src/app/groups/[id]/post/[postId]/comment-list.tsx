"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { toggleLikeComment, getReplies } from "@/app/actions/comments";

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

function CommentItem({
  comment,
  currentUserId,
  onReply,
  isReply = false,
}: {
  comment: Comment;
  currentUserId: string;
  onReply: (commentId: string, userName: string) => void;
  isReply?: boolean;
}) {
  const [liked, setLiked] = useState(comment.hasLiked);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const likedRef = useRef(liked);
  likedRef.current = liked;
  const likeCountRef = useRef(likeCount);
  likeCountRef.current = likeCount;

  const handleLike = () => {
    const wasLiked = likedRef.current;
    setLiked(!wasLiked);
    setLikeCount(
      wasLiked ? likeCountRef.current - 1 : likeCountRef.current + 1,
    );
    toggleLikeComment(comment.id);
  };

  const parentId = comment.parentId || comment.id;

  return (
    <div className="flex gap-2.5">
      {comment.userImage ? (
        <img
          src={comment.userImage}
          alt={comment.userName || ""}
          className={`${isReply ? "h-6 w-6" : "h-8 w-8"} shrink-0 rounded-full object-cover`}
        />
      ) : (
        <div
          className={`flex ${isReply ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"} shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground`}
        >
          {(comment.userName || comment.userId).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-muted/50 px-3 py-2">
          {comment.userHandle ? (
            <a
              href={`/profile/${comment.userHandle}`}
              className="text-xs font-medium hover:underline"
            >
              {comment.userName || comment.userId}
            </a>
          ) : (
            <span className="text-xs font-medium">
              {comment.userName || comment.userId}
            </span>
          )}
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-2 text-xs text-muted-foreground">
          <span>{timeAgo(new Date(comment.createdAt))}</span>
          <button
            onClick={handleLike}
            className={`font-medium transition hover:text-red-500 ${liked ? "text-red-500" : ""}`}
          >
            {liked ? "Liked" : "Like"}
            {likeCount > 0 ? ` (${likeCount})` : ""}
          </button>
          <button
            onClick={() =>
              onReply(parentId, comment.userName || comment.userId)
            }
            className="font-medium transition hover:text-foreground"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentWithReplies({
  comment,
  currentUserId,
  onReply,
  optimisticReplies = [],
}: {
  comment: Comment;
  currentUserId: string;
  onReply: (commentId: string, userName: string) => void;
  optimisticReplies?: Comment[];
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [fetchedReplies, setFetchedReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (optimisticReplies.length > 0 && !showReplies) {
      setShowReplies(true);
    }
  }, [optimisticReplies.length]);

  const mergedReplies = (() => {
    const fetchedIds = new Set(fetchedReplies.map((r) => r.id));
    const extra = optimisticReplies.filter((r) => !fetchedIds.has(r.id));
    return [...fetchedReplies, ...extra];
  })();

  const handleToggleReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }
    if (!hasFetched) {
      setLoadingReplies(true);
      try {
        const result = await getReplies(comment.id);
        setFetchedReplies(result as Comment[]);
        setHasFetched(true);
      } finally {
        setLoadingReplies(false);
      }
    }
    setShowReplies(true);
  };

  const [liked, setLiked] = useState(comment.hasLiked);
  const likedRef = useRef(liked);
  likedRef.current = liked;

  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const likeCountRef = useRef(likeCount);
  likeCountRef.current = likeCount;

  const handleLike = () => {
    const wasLiked = likedRef.current;
    setLiked(!wasLiked);
    setLikeCount(
      wasLiked ? likeCountRef.current - 1 : likeCountRef.current + 1,
    );
    toggleLikeComment(comment.id);
  };

  const repliesVisible = showReplies && mergedReplies.length > 0;

  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        {comment.userImage ? (
          <img
            src={comment.userImage}
            alt={comment.userName || ""}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
            {(comment.userName || comment.userId).charAt(0).toUpperCase()}
          </div>
        )}
        {repliesVisible && <div className="mt-1 w-0.5 flex-1 bg-border" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-muted/50 px-3 py-2">
          {comment.userHandle ? (
            <a
              href={`/profile/${comment.userHandle}`}
              className="text-xs font-medium hover:underline"
            >
              {comment.userName || comment.userId}
            </a>
          ) : (
            <span className="text-xs font-medium">
              {comment.userName || comment.userId}
            </span>
          )}
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-2 text-xs text-muted-foreground">
          <span>{timeAgo(new Date(comment.createdAt))}</span>
          <button
            onClick={handleLike}
            className={`font-medium transition hover:text-red-500 ${liked ? "text-red-500" : ""}`}
          >
            {liked ? "Liked" : "Like"}
            {likeCount > 0 ? ` (${likeCount})` : ""}
          </button>
          <button
            onClick={() =>
              onReply(comment.id, comment.userName || comment.userId)
            }
            className="font-medium transition hover:text-foreground"
          >
            Reply
          </button>
        </div>

        {comment.replyCount > 0 && (
          <button
            onClick={handleToggleReplies}
            disabled={loadingReplies}
            className="mt-1 flex items-center gap-1 px-2 text-xs font-medium text-primary transition hover:underline"
          >
            <ChevronDown
              className={`size-3 transition ${showReplies ? "rotate-180" : ""}`}
            />
            {loadingReplies
              ? "Loading..."
              : showReplies
                ? "Hide replies"
                : `Show ${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`}
          </button>
        )}

        {repliesVisible && (
          <div className="mt-2">
            {mergedReplies.map((reply, i) => {
              const isLast = i === mergedReplies.length - 1;
              return (
                <div key={reply.id} className="relative pb-3 last:pb-0">
                  <div className="absolute -left-[27px] top-0 h-3.5 w-[27px] rounded-bl-xl border-b-2 border-l-2 border-border" />
                  {!isLast && (
                    <div className="absolute -left-[27px] top-3.5 bottom-0 w-0.5 bg-border" />
                  )}
                  {isLast && (
                    <div className="absolute -left-[27px] top-3.5 bottom-0 z-10 w-2 bg-background" />
                  )}
                  <CommentItem
                    comment={reply}
                    currentUserId={currentUserId}
                    onReply={onReply}
                    isReply
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentList({
  comments,
  currentUserId,
  onReply,
  newRepliesMap = {},
}: {
  comments: Comment[];
  currentUserId: string;
  onReply: (commentId: string, userName: string) => void;
  newRepliesMap?: Record<string, Comment[]>;
}) {
  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentWithReplies
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onReply={onReply}
          optimisticReplies={newRepliesMap[comment.id] || []}
        />
      ))}
    </div>
  );
}
