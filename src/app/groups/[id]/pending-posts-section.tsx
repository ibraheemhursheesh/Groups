"use client";

import { Button } from "@/components/ui/button";
import { handlePostApproval } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

type PendingPost = {
  id: string;
  userId: string;
  userName: string | null;
  content: string;
  createdAt: Date;
};

export function PendingPostsSection({
  groupId,
  posts,
}: {
  groupId: string;
  posts: PendingPost[];
}) {
  const router = useRouter();
  const [realPosts, setRealPosts] = useState(posts);
  const [optimisticPosts, removeOptimisticPost] = useOptimistic(
    realPosts,
    (currentPosts: PendingPost[], postId: string) =>
      currentPosts.filter((post) => post.id !== postId),
  );
  const [isPending, startTransition] = useTransition();

  if (optimisticPosts.length === 0) return null;

  const approve = async (postId: string) => {
    startTransition(async () => {
      removeOptimisticPost(postId);

      try {
        await handlePostApproval(postId, groupId, "approve");
        setRealPosts((currentPosts) =>
          currentPosts.filter((post) => post.id !== postId),
        );
        router.refresh();
      } catch {
        // Let the optimistic state roll back to the real list on failure.
      }
    });
  };

  const reject = async (postId: string) => {
    startTransition(async () => {
      removeOptimisticPost(postId);

      try {
        await handlePostApproval(postId, groupId, "reject");
        setRealPosts((currentPosts) =>
          currentPosts.filter((post) => post.id !== postId),
        );
        router.refresh();
      } catch {
        // Let the optimistic state roll back to the real list on failure.
      }
    });
  };

  return (
    <div className="mb-6 rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">
        Pending posts ({optimisticPosts.length})
      </h3>
      <ul className="space-y-3">
        {optimisticPosts.map((post) => (
          <li key={post.id} className="rounded-lg bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {post.userName || post.userId}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => approve(post.id)}
                  disabled={isPending}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reject(post.id)}
                  disabled={isPending}
                >
                  Reject
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm">{post.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
