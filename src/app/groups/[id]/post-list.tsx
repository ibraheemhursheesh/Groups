"use client";

import { Button } from "@/components/ui/button";
import { deletePost } from "@/app/actions/groups";
import { useRouter } from "next/navigation";

type Post = {
  id: string;
  userId: string;
  userName: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
};

export function PostList({
  posts,
  currentUserId,
  isAdmin,
  groupId,
}: {
  posts: Post[];
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
          <li key={post.id} className="overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between px-4 pt-4">
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
