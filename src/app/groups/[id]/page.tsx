import { getGroupPageData } from "@/app/actions/groups";
import { JoinButton } from "./join-button";
import { PendingRequestsSection } from "./pending-requests-section";
import { PostsWrapper } from "./posts-wrapper";
import { GroupActions } from "./leave-button";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getGroupPageData(id);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Group not found.</p>
      </div>
    );
  }

  const {
    organization,
    currentMember,
    currentUserImage,
    joinRequest,
    pendingRequests,
    pendingPosts,
    approvedPosts,
    approvedNextCursor,
    myPendingPosts,
  } = data;
  const org = organization;
  const metadata = typeof org.metadata === "string"
    ? JSON.parse(org.metadata || "{}")
    : (org.metadata || {});

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        {org.logo && (
          <img
            src={org.logo}
            alt={`${org.name} cover`}
            className="mb-6 aspect-video w-full rounded-xl border object-cover"
          />
        )}
        <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
        {metadata?.description && (
          <p className="mt-2 text-muted-foreground">{metadata.description}</p>
        )}
        {currentMember && (
          <p className="mt-1 text-xs text-muted-foreground">
            Role: {currentMember.role}
          </p>
        )}
      </div>

      {!currentMember && (
        <JoinButton groupId={id} hasExistingRequest={!!joinRequest} />
      )}

      {currentMember && (
        <>
          {currentMember.role === "admin" && (
            <PendingRequestsSection
              groupId={id}
              requests={pendingRequests as any[]}
            />
          )}

          <PostsWrapper
            groupId={id}
            isAdmin={currentMember.role === "admin"}
            currentUserId={currentMember.userId}
            currentUserName={(currentMember as any).user?.name || null}
            currentUserImage={currentUserImage}
            initialApprovedPosts={approvedPosts as any[]}
            initialNextCursor={approvedNextCursor}
            initialPendingPosts={pendingPosts as any[]}
            initialMyPendingPosts={myPendingPosts as any[]}
          />

          <GroupActions groupId={id} isAdmin={currentMember.role === "admin"} />
        </>
      )}
    </main>
  );
}
