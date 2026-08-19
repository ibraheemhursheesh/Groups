"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/index";
import { user } from "@/db/schema";
import { auth } from "@/app/lib/auth";
import { uploadProfilePhoto } from "@/app/lib/supabase";

export async function getProfileByHandle(handle: string) {
  const [profile] = await db
    .select({
      id: user.id,
      name: user.name,
      handle: user.handle,
      image: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.handle, handle.toLowerCase()));

  return profile ?? null;
}

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Not authenticated" };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name || name.length === 0) {
    return { ok: false, error: "Name cannot be empty." };
  }
  if (name.length > 50) {
    return { ok: false, error: "Name must be 50 characters or fewer." };
  }

  const photoFile = formData.get("photo") as File | null;
  let imageUrl: string | undefined;

  if (photoFile && photoFile.size > 0) {
    if (photoFile.size > 4 * 1024 * 1024) {
      return { ok: false, error: "Photo must be under 4 MB." };
    }
    if (!photoFile.type.startsWith("image/")) {
      return { ok: false, error: "File must be an image." };
    }

    const url = await uploadProfilePhoto(photoFile, session.user.id);
    if (!url) return { ok: false, error: "Failed to upload photo." };
    imageUrl = url;
  }

  const [userData] = await db
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, session.user.id));

  await db
    .update(user)
    .set({
      name,
      ...(imageUrl !== undefined && { image: imageUrl }),
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id));

  if (userData) {
    revalidatePath(`/profile/${userData.handle}`);
  }

  return { ok: true };
}
