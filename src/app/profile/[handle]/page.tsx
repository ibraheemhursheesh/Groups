import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { getProfileByHandle } from "@/app/actions/profile";
import { ProfileClient } from "./profile-client";

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

  return (
    <ProfileClient
      profile={{
        name: profile.name,
        handle: profile.handle,
        image: profile.image,
        createdAt: profile.createdAt,
      }}
      isOwner={isOwner}
    />
  );
}
