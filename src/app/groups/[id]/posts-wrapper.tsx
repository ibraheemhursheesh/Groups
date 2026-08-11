"use client";

import { useState, useTransition } from "react";
import { PostForm } from "./post-form";
import { PendingPostsSection } from "./pending-posts-section";
import { PendingRequestsSection } from "./pending-requests-section";
import { PostList } from "./post-list";
import { PostImages } from "./post-images";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPost,
  handlePostApproval,
  deletePost,
  editPost,
  getApprovedPosts,
  handleJoinRequest,
} from "@/app/actions/groups";

type Post = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  content: string;
  images: string[];
  createdAt: Date;
};

type MyPendingPost = {
  id: string;
  content: string;
  images: string[];
  createdAt: Date;
};

type PendingRequest = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  createdAt: Date;
};

export function PostsWrapper({
  groupId,
  isAdmin,
  currentUserId,
  currentUserName,
  currentUserImage,
  viewOnly = false,
  initialApprovedPosts,
  initialNextCursor,
  initialPendingPosts,
  initialMyPendingPosts,
  initialPendingRequests,
}: {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string;
  currentUserName: string | null;
  currentUserImage: string | null;
  viewOnly?: boolean;
  initialApprovedPosts: Post[];
  initialNextCursor: string | null;
  initialPendingPosts: Post[];
  initialMyPendingPosts: MyPendingPost[];
  initialPendingRequests: PendingRequest[];
}) {
  const [approvedPosts, setApprovedPosts] = useState(initialApprovedPosts);
  const [pendingPosts, setPendingPosts] = useState(initialPendingPosts);
  const [myPendingPosts, setMyPendingPosts] = useState(initialMyPendingPosts);
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, startLoadMore] = useTransition();

  const handlePostSubmit = async (formData: FormData) => {
    formData.set("groupId", groupId);

    const imageFiles = formData.getAll("images") as File[];
    const optimisticImageUrls = imageFiles
      .filter((f) => f.size > 0)
      .map((f) => URL.createObjectURL(f));

    if (isAdmin) {
      setApprovedPosts((prev) => [
        {
          id: `optimistic-${crypto.randomUUID()}`,
          userId: currentUserId,
          userName: currentUserName,
          userImage: currentUserImage,
          content: (formData.get("content") as string)?.trim() || "",
          images: optimisticImageUrls,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    } else {
      setMyPendingPosts((prev) => [
        {
          id: `optimistic-${crypto.randomUUID()}`,
          content: (formData.get("content") as string)?.trim() || "",
          images: optimisticImageUrls,
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

  const handleEdit = async (
    postId: string,
    groupId: string,
    content: string,
    existingUrls: string[],
    newFiles: File[],
  ) => {
    const optimisticImages = [
      ...existingUrls,
      ...newFiles.filter((f) => f.size > 0).map((f) => URL.createObjectURL(f)),
    ];
    setApprovedPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, content, images: optimisticImages } : p,
      ),
    );
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("groupId", groupId);
    formData.set("content", content);
    formData.set("existingUrls", JSON.stringify(existingUrls));
    for (const file of newFiles) {
      if (file.size > 0) formData.append("newFiles", file);
    }
    const finalImages = await editPost(formData);
    setApprovedPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, content, images: finalImages } : p,
      ),
    );
  };

  const handleApproveRequest = async (requestId: string) => {
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    await handleJoinRequest(requestId, groupId, "approve");
  };

  const handleRejectRequest = async (requestId: string) => {
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    await handleJoinRequest(requestId, groupId, "reject");
  };

  const handleLoadMore = () => {
    if (!cursor) return;
    startLoadMore(async () => {
      const result = await getApprovedPosts(groupId, cursor, 10);
      setApprovedPosts((prev) => [...prev, ...result.posts]);
      setCursor(result.nextCursor);
    });
  };

  return (
    <>
      {!viewOnly && (
        <PostForm
          groupId={groupId}
          isAdmin={isAdmin}
          onOptimisticSubmit={handlePostSubmit}
        />
      )}

      {isAdmin && (pendingRequests.length > 0 || pendingPosts.length > 0) && (
        <div className="mb-6">
          <Tabs defaultValue={pendingRequests.length > 0 ? "requests" : "posts"}>
            <TabsList>
              <TabsTrigger value="requests">
                Join requests ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="posts">
                Pending posts ({pendingPosts.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="requests">
              {pendingRequests.length > 0 && (
                <PendingRequestsSection
                  requests={pendingRequests}
                  onApprove={handleApproveRequest}
                  onReject={handleRejectRequest}
                />
              )}
            </TabsContent>
            <TabsContent value="posts">
              {pendingPosts.length > 0 && (
                <PendingPostsSection
                  posts={pendingPosts}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
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
                <PostImages images={post.images} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <PostList
        posts={approvedPosts}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        groupId={groupId}
        onDelete={handleDelete}
        onEdit={handleEdit}
        hasMore={cursor !== null}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
      />
    </>
  );
}