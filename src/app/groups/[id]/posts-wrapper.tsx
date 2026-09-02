"use client";

import { useState, useTransition } from "react";
import { PostComposer } from "./post-composer";
import { PendingPostsSection } from "./pending-posts-section";
import { PendingRequestsSection } from "./pending-requests-section";
import { PostList } from "./post-list";
import { PostImages } from "./post-images";
import { PollBlock } from "./poll-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPost,
  handlePostApproval,
  deletePost,
  editPost,
  getApprovedPosts,
  handleJoinRequest,
  sharePost,
} from "@/app/actions/groups";
import { parseLinkPreview, type LinkPreview } from "@/lib/links";
import { buildPollResults, type PollResults } from "@/lib/poll";

type Post = {
  id: string;
  userId: string;
  userName: string | null;
  userHandle: string | null;
  userImage: string | null;
  content: string;
  images: string[];
  linkPreview: LinkPreview | null;
  poll: PollResults | null;
  likeCount: number;
  hasLiked: boolean;
  originalPostId: string | null;
  origContent: string | null;
  origImages: string[] | null;
  origUserName: string | null;
  origUserImage: string | null;
  origCreatedAt: Date | null;
  createdAt: Date;
};

type MyPendingPost = {
  id: string;
  content: string;
  images: string[];
  poll: PollResults | null;
  createdAt: Date;
};

type PendingRequest = {
  id: string;
  userId: string;
  userName: string | null;
  userHandle: string | null;
  userImage: string | null;
  createdAt: Date;
};

export function PostsWrapper({
  groupId,
  isAdmin,
  currentUserId,
  currentUserName,
  currentUserHandle,
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
  currentUserHandle: string | null;
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
    // The composer already fetched the card; it rides along for the optimistic
    // post only. What gets stored is whatever the server fetches for
    // `previewUrl`, so a client cannot publish a card of its own making.
    const optimisticPreview = parseLinkPreview(formData.get("previewData"));
    formData.delete("previewData");

    formData.set("groupId", groupId);

    const imageFiles = formData.getAll("images") as File[];
    const optimisticImageUrls = imageFiles
      .filter((f) => f.size > 0)
      .map((f) => URL.createObjectURL(f));
    const optimisticId = `optimistic-${crypto
      .getRandomValues(new Uint8Array(16))
      .reduce(
        (s, b, i) =>
          s +
          (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
          b.toString(16).padStart(2, "0"),
        "",
      )}`;

    // Placeholder option ids, good only for drawing the empty poll. The real
    // ones are minted server-side and swapped in below — voting on the
    // optimistic copy would name choices no server has heard of.
    const pollJson = formData.get("poll") as string | null;
    const optimisticPoll = pollJson
      ? buildPollResults(
          {
            options: (JSON.parse(pollJson) as string[]).map((text, i) => ({
              id: `optimistic-${i}`,
              text,
            })),
          },
          {},
          null,
        )
      : null;

    if (isAdmin) {
      setApprovedPosts((prev) => [
        {
          id: optimisticId,
          userId: currentUserId,
          userName: currentUserName,
          userHandle: currentUserHandle,
          userImage: currentUserImage,
          content: (formData.get("content") as string)?.trim() || "",
          images: optimisticImageUrls,
          linkPreview: optimisticPreview,
          poll: optimisticPoll,
          likeCount: 0,
          hasLiked: false,
          originalPostId: null,
          origContent: null,
          origImages: null,
          origUserName: null,
          origUserImage: null,
          origCreatedAt: null,
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
          poll: optimisticPoll,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    }

    createPost(formData).then((created) => {
      if (!created) return;
      // The poll arrives with the server's option ids, so the post the author
      // is already looking at becomes answerable in place.
      const adopt = <T extends { id: string; poll: PollResults | null }>(
        list: T[],
      ) =>
        list.map((p) =>
          p.id === optimisticId
            ? { ...p, id: created.id, poll: created.poll ?? p.poll }
            : p,
        );
      setApprovedPosts(adopt);
      setMyPendingPosts(adopt);
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
    previewUrl: string,
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
    formData.set("previewUrl", previewUrl);
    formData.set("existingUrls", JSON.stringify(existingUrls));
    for (const file of newFiles) {
      if (file.size > 0) formData.append("newFiles", file);
    }
    const saved = await editPost(formData);
    setApprovedPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              content,
              images: saved.images,
              linkPreview: saved.linkPreview,
            }
          : p,
      ),
    );
  };

  const handleShare = (formData: FormData) => {
    const originalPostId = formData.get("originalPostId") as string;
    const content = (formData.get("content") as string) || "";
    const origContent = formData.get("origContent") as string;
    const origImagesJson = formData.get("origImages") as string;
    const origImages = origImagesJson
      ? (JSON.parse(origImagesJson) as string[])
      : [];
    const origUserName = formData.get("origUserName") as string;
    const origUserImage = formData.get("origUserImage") as string;
    const origCreatedAtStr = formData.get("origCreatedAt") as string;

    if (isAdmin) {
      setApprovedPosts((prev) => [
        {
          id: `optimistic-${crypto
            .getRandomValues(new Uint8Array(16))
            .reduce(
              (s, b, i) =>
                s +
                (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
                b.toString(16).padStart(2, "0"),
              "",
            )}`,
          userId: currentUserId,
          userName: currentUserName,
          userHandle: currentUserHandle,
          userImage: currentUserImage,
          content,
          images: [],
          // A share's card slot is taken by the post it quotes.
          linkPreview: null,
          // Sharing a poll quotes the question; the choices stay answerable on
          // the original, so a share never carries a poll of its own.
          poll: null,
          likeCount: 0,
          hasLiked: false,
          originalPostId,
          origContent: origContent ?? null,
          origImages: origImages.length > 0 ? origImages : null,
          origUserName: origUserName ?? null,
          origUserImage: origUserImage ?? null,
          origCreatedAt: origCreatedAtStr ? new Date(origCreatedAtStr) : null,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    } else {
      setMyPendingPosts((prev) => [
        {
          id: `optimistic-${crypto
            .getRandomValues(new Uint8Array(16))
            .reduce(
              (s, b, i) =>
                s +
                (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
                b.toString(16).padStart(2, "0"),
              "",
            )}`,
          content,
          images: [],
          poll: null,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    }

    sharePost(formData);
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
              onShare={handleShare}
              hasMore={cursor !== null}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
              canVote={!viewOnly}
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
              onShare={handleShare}
              hasMore={cursor !== null}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
              canVote={!viewOnly}
            />
          </TabsContent>

          <TabsContent value="my-pending">
            <div className="space-y-3">
              {myPendingPosts.map((post) => (
                <div key={post.id} className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm">{post.content}</p>
                  <PostImages images={post.images} />
                  {/* Nobody can answer a poll that is still awaiting
                      approval, so the author sees the choices, not a ballot. */}
                  {post.poll && (
                    <PollBlock poll={post.poll} canVote={false} className="mt-3" />
                  )}
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
              onShare={handleShare}
          hasMore={cursor !== null}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
              canVote={!viewOnly}
        />
      )}
    </>
  );
}