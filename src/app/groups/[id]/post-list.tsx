"use client";

import { Button } from "@/components/ui/button";
import { deletePost } from "@/app/actions/groups";
import { useRouter } from "next/navigation";

export function PostList({
  posts,
  currentUserId,
  isAdmin,
  groupId,
}: {
  posts: { id: string; userId: string; userName: string | null; content: string; createdAt: Date }[];
  currentUserId: string;
  isAdmin: boolean;
  groupId: string;
}) {
  const router = useRouter();

  const handleDelete = async (postId: string) => {
    await deletePost(postId, groupId);
    router.refresh();
  };

  if (posts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No posts yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Posts</h3>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {post.userName || post.userId}
                {" "}
                {new Date(post.createdAt).toLocaleDateString()}
              </span>
              {(isAdmin || post.userId === currentUserId) && (
                <Button variant="ghost" size="xs" onClick={() => handleDelete(post.id)}>
                  Delete
                </Button>
              )}
            </div>
            <p className="mt-2 text-sm">{post.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
