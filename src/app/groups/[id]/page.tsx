import { getGroupPageData } from "@/app/actions/groups";
import { JoinButton } from "./join-button";
import { PostsWrapper } from "./posts-wrapper";
import { GroupActions } from "./leave-button";
import { MembersList } from "./members-list";
import { GroupSettingsDialog } from "./group-settings-dialog";
import Image from "next/image";

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
    members,
  } = data;
  const org = organization;
  const metadata = typeof org.metadata === "string"
    ? JSON.parse(org.metadata || "{}")
    : (org.metadata || {});
  const isPublic = !metadata?.isPrivate;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        {org.logo && (
          <Image
            src={org.logo}
            alt={`${org.name} cover`}
            className="mb-6 aspect-video w-full rounded-xl border object-cover"
            width={700}
            height={400}
          />
        )}
        <h1
          className={
            "text-2xl font-bold tracking-tight" +
            (currentMember?.role === "admin" ? " text-indigo-300 italic" : "")
          }
        >
          {org.name}
        </h1>
        {metadata?.description && (
          <p className="mt-2 text-muted-foreground text-sm md:text-base">
            {metadata.description}
          </p>
        )}
        {currentMember && (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* <p className="text-xs text-muted-foreground">
                Role: {currentMember.role}
              </p> */}
              <MembersList
                members={members as any[]}
                currentUserId={currentMember.userId}
                isAdmin={currentMember.role === "admin"}
                groupId={id}
              />
            </div>
            {currentMember.role === "admin" && (
              <GroupSettingsDialog
                groupId={id}
                name={org.name}
                description={metadata?.description || ""}
                logo={org.logo ?? null}
                isPrivate={!!metadata?.isPrivate}
              />
            )}
          </div>
        )}
      </div>

      {!currentMember && !isPublic && (
        <JoinButton
          groupId={id}
          hasExistingRequest={!!joinRequest}
          isPublic={false}
        />
      )}

      {!currentMember && isPublic && (
        <>
          <PostsWrapper
            groupId={id}
            isAdmin={false}
            currentUserId=""
            currentUserName={null}
            currentUserImage={null}
            viewOnly
            initialApprovedPosts={approvedPosts as any[]}
            initialNextCursor={approvedNextCursor}
            initialPendingPosts={[]}
            initialMyPendingPosts={[]}
            initialPendingRequests={[]}
          />
          <div className="mb-6">
            <JoinButton groupId={id} hasExistingRequest={false} isPublic />
          </div>
        </>
      )}

      {currentMember && (
        <>
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
            initialPendingRequests={pendingRequests as any[]}
          />

          <GroupActions groupId={id} isAdmin={currentMember.role === "admin"} />
        </>
      )}
    </main>
  );
}
