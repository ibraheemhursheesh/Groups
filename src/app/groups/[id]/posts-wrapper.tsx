"use client";

import { useState } from "react";
import { PostForm } from "./post-form";
import { PendingPostsSection } from "./pending-posts-section";
import { PostList } from "./post-list";
import { createPost, handlePostApproval, deletePost } from "@/app/actions/groups";

type Post = {
  id: string;
  userId: string;
  userName: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
};

type MyPendingPost = {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
};

export function PostsWrapper({
  groupId,
  isAdmin,
  currentUserId,
  currentUserName,
  initialApprovedPosts,
  initialPendingPosts,
  initialMyPendingPosts,
}: {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string;
  currentUserName: string | null;
  initialApprovedPosts: Post[];
  initialPendingPosts: Post[];
  initialMyPendingPosts: MyPendingPost[];
}) {
  const [approvedPosts, setApprovedPosts] = useState(initialApprovedPosts);
  const [pendingPosts, setPendingPosts] = useState(initialPendingPosts);
  const [myPendingPosts, setMyPendingPosts] = useState(initialMyPendingPosts);

  const handlePostSubmit = async (formData: FormData) => {
    formData.set("groupId", groupId);

    if (isAdmin) {
      setApprovedPosts((prev) => [
        {
          id: `optimistic-${crypto.randomUUID()}`,
          userId: currentUserId,
          userName: currentUserName,
          content: (formData.get("content") as string)?.trim() || "",
          imageUrl: null,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    } else {
      setMyPendingPosts((prev) => [
        {
          id: `optimistic-${crypto.randomUUID()}`,
          content: (formData.get("content") as string)?.trim() || "",
          imageUrl: null,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    }

    await createPost(formData);
  };

  const handleApprove = async (postId: string) => {
    const post = pendingPosts.find((p) => p.id === postId);
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
    if (post) {
      setApprovedPosts((prev) => [post, ...prev]);
    }
    await handlePostApproval(postId, groupId, "approve");
  };

  const handleReject = async (postId: string) => {
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
    await handlePostApproval(postId, groupId, "reject");
  };

  const handleDelete = async (postId: string) => {
    setApprovedPosts((prev) => prev.filter((p) => p.id !== postId));
    await deletePost(postId, groupId);
  };

  return (
    <>
      <PostForm groupId={groupId} isAdmin={isAdmin} onOptimisticSubmit={handlePostSubmit} />

      {isAdmin && pendingPosts.length > 0 && (
        <PendingPostsSection
          posts={pendingPosts}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {!isAdmin && myPendingPosts.length > 0 && (
        <div className="mb-6 rounded-xl border p-4">
          <h3 className="mb-3 font-semibold text-sm text-muted-foreground">
            Your pending posts ({myPendingPosts.length})
          </h3>
          <ul className="space-y-3">
            {myPendingPosts.map((post) => (
              <li key={post.id} className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm">{post.content}</p>
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt="Pending post"
                    className="mt-2 w-full rounded-lg object-cover"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PostList
        posts={approvedPosts}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onDelete={handleDelete}
      />
    </>
  );
}
