"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";

type PendingPost = {
  id: string;
  userId: string;
  userName: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
};

export function PendingPostsSection({
  posts,
  onApprove,
  onReject,
}: {
  posts: PendingPost[];
  onApprove: (postId: string) => Promise<void>;
  onReject: (postId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = (postId: string) => {
    startTransition(() => {
      onApprove(postId);
    });
  };

  const handleReject = (postId: string) => {
    startTransition(() => {
      onReject(postId);
    });
  };

  return (
    <div className="mb-6 rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">Pending posts ({posts.length})</h3>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="overflow-hidden rounded-lg bg-muted/50">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-xs text-muted-foreground">
                {post.userName || post.userId}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleApprove(post.id)}
                  disabled={isPending}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReject(post.id)}
                  disabled={isPending}
                >
                  Reject
                </Button>
              </div>
            </div>
            <p className="px-4 pb-4 pt-2 text-sm whitespace-pre-wrap">{post.content}</p>
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
    </div>
  );
}
