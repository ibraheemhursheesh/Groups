import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { getProfileByHandle } from "@/app/actions/profile";
import { getProfilePosts } from "@/app/actions/profile-posts";
import { ProfileClient } from "./profile-client";
import { ProfileFeed } from "./profile-feed";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  return {
    title: profile
      ? `${profile.name} (@${profile.handle}) · Groupss`
      : "Profile not found · Groupss",
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = session?.user.id === profile.id;

  const { posts, nextCursor } = await getProfilePosts(profile.handle);

  return (
    <ProfileClient
      profile={{
        name: profile.name,
        handle: profile.handle,
        image: profile.image,
        createdAt: profile.createdAt,
      }}
      isOwner={isOwner}
    >
      <ProfileFeed
        author={{
          id: profile.id,
          name: profile.name,
          handle: profile.handle,
          image: profile.image,
        }}
        isOwner={isOwner}
        initialPosts={posts}
        initialNextCursor={nextCursor}
      />
    </ProfileClient>
  );
}
