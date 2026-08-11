"use client";

import { useState, useTransition } from "react";
import { PostComposer } from "./post-composer";
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
  likeCount: number;
  hasLiked: boolean;
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

  const handlePostSubmit = (formData: FormData) => {
    formData.set("groupId", groupId);

    const imageFiles = formData.getAll("images") as File[];
    const optimisticImageUrls = imageFiles
      .filter((f) => f.size > 0)
      .map((f) => URL.createObjectURL(f));
    const optimisticId = `optimistic-${crypto.randomUUID()}`;

    if (isAdmin) {
      setApprovedPosts((prev) => [
        {
          id: optimisticId,
          userId: currentUserId,
          userName: currentUserName,
          userImage: currentUserImage,
          content: (formData.get("content") as string)?.trim() || "",
          images: optimisticImageUrls,
          likeCount: 0,
          hasLiked: false,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    } else {
      setMyPendingPosts((prev) => [
        {
          id: optimisticId,
          content: (formData.get("content") as string)?.trim() || "",
          images: optimisticImageUrls,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    }

    createPost(formData).then((realId) => {
      if (realId) {
        setApprovedPosts((prev) =>
          prev.map((p) => (p.id === optimisticId ? { ...p, id: realId } : p)),
        );
      }
    });
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
      {!viewOnly && !isAdmin && (
        <PostComposer
          groupId={groupId}
          isAdmin={isAdmin}
          onOptimisticSubmit={handlePostSubmit}
        />
      )}

      {isAdmin ? (
        <Tabs defaultValue="posts">
          <TabsList className="bg-transparent w-full">
            <TabsTrigger className="py-2.5" value="posts">
              Posts
            </TabsTrigger>
            {pendingPosts.length > 0 && (
              <TabsTrigger className="py-2.5" value="pending-posts">
                Pending posts ({pendingPosts.length})
              </TabsTrigger>
            )}
            {pendingRequests.length > 0 && (
              <TabsTrigger className="py-2.5" value="requests">
                Join requests ({pendingRequests.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="posts">
            <PostComposer
              groupId={groupId}
              isAdmin={isAdmin}
              onOptimisticSubmit={handlePostSubmit}
            />
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
          </TabsContent>

          <TabsContent value="pending-posts">
            <PendingPostsSection
              posts={pendingPosts}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </TabsContent>

          <TabsContent value="requests">
            <PendingRequestsSection
              requests={pendingRequests}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
            />
          </TabsContent>
        </Tabs>
      ) : myPendingPosts.length > 0 ? (
        <Tabs defaultValue="posts">
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="my-pending">
              Your pending posts ({myPendingPosts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts">
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
          </TabsContent>

          <TabsContent value="my-pending">
            <div className="space-y-3">
              {myPendingPosts.map((post) => (
                <div key={post.id} className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm">{post.content}</p>
                  <PostImages images={post.images} />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
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
      )}
    </>
  );
}