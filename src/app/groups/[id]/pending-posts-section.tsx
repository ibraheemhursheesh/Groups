"use client";

import { Button } from "@/components/ui/button";
import { handlePostApproval } from "@/app/actions/groups";
import { useRouter } from "next/navigation";

export function PendingPostsSection({
  groupId,
  posts,
}: {
  groupId: string;
  posts: { id: string; userId: string; userName: string | null; content: string; createdAt: Date }[];
}) {
  const router = useRouter();

  if (posts.length === 0) return null;

  const approve = async (postId: string) => {
    await handlePostApproval(postId, groupId, "approve");
    router.refresh();
  };

  const reject = async (postId: string) => {
    await handlePostApproval(postId, groupId, "reject");
    router.refresh();
  };

  return (
    <div className="mb-6 rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">
        Pending posts ({posts.length})
      </h3>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="rounded-lg bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {post.userName || post.userId}
              </span>
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={() => approve(post.id)}>Approve</Button>
                <Button variant="outline" size="sm" onClick={() => reject(post.id)}>Reject</Button>
              </div>
            </div>
            <p className="mt-2 text-sm">{post.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
