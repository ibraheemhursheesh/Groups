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
  imageUrl: string | null;
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
      } catch {}
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
      } catch {}
    });
  };

  return (
    <div className="mb-6 rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">
        Pending posts ({optimisticPosts.length})
      </h3>
      <ul className="space-y-3">
        {optimisticPosts.map((post) => (
          <li key={post.id} className="overflow-hidden rounded-lg bg-muted/50">
            <div className="flex items-center justify-between px-4 pt-3">
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
            <p className="px-4 pb-4 pt-2 text-sm">{post.content}</p>
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
