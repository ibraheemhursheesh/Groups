"use server";

import { and, desc, eq, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/index";
import { posts, user } from "@/db/schema";
import { auth } from "@/app/lib/auth";
import { supabase, STORAGE_BUCKET } from "@/app/lib/supabase";
import { newId } from "@/lib/id";
import { profileFeedId } from "@/lib/profile-feed";
import { resolvePostLinkPreview } from "@/app/lib/link-preview";
import { type LinkPreview, parseLinkPreview } from "@/lib/links";

const MAX_IMAGES = 10;
const PAGE_SIZE = 10;

export type ProfilePost = {
  id: string;
  userId: string;
  userName: string | null;
  userHandle: string | null;
  userImage: string | null;
  content: string;
  images: string[];
  linkPreview: LinkPreview | null;
  createdAt: Date;
};

const parseImages = (images: unknown): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  try {
    return JSON.parse(images as string);
  } catch {
    return [];
  }
};

/**
 * Posts on someone's profile. Readable by anyone who can see the profile —
 * unlike group feeds there is no membership to check.
 */
export const getProfilePosts = async (
  handle: string,
  cursor?: string,
  limit = PAGE_SIZE,
): Promise<{ posts: ProfilePost[]; nextCursor: string | null }> => {
  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.handle, handle.toLowerCase()));

  if (!owner) return { posts: [], nextCursor: null };

  const conditions = [
    eq(posts.groupId, profileFeedId(owner.id)),
    eq(posts.status, "approved"),
  ];
  if (cursor) {
    conditions.push(lt(posts.createdAt, new Date(cursor)));
  }

  const rows = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      userName: user.name,
      userHandle: user.handle,
      userImage: user.image,
      content: posts.content,
      images: posts.images,
      linkPreview: posts.linkPreview,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .leftJoin(user, eq(posts.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    posts: items.map((p) => ({
      ...p,
      images: parseImages(p.images),
      linkPreview: parseLinkPreview(p.linkPreview),
    })),
    nextCursor: hasMore
      ? items[items.length - 1].createdAt.toISOString()
      : null,
  };
};

/**
 * Writes a post to the caller's own profile feed. The target is taken from the
 * session rather than the request, so there is no way to post onto someone
 * else's profile through this endpoint.
 */
export const createProfilePost = async (formData: FormData) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const content = ((formData.get("content") as string) || "").trim();
  const imageFiles = (formData.getAll("images") as File[]).filter(
    (f) => f && f.size > 0,
  );

  if (!content && imageFiles.length === 0) {
    throw new Error("Post content or an image is required");
  }
  if (imageFiles.length > MAX_IMAGES) {
    throw new Error(`A post can hold at most ${MAX_IMAGES} images`);
  }

  const userId = session.user.id;
  const postId = newId();
  const imageUrls: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const ext = file.name.split(".").pop() || "png";
    const path = `profiles/${userId}/posts/${postId}_${i}.${ext}`;
    const uploadResult = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadResult.error) {
      console.error("Upload error:", uploadResult.error.message);
      continue;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    imageUrls.push(data.publicUrl);
  }

  const createdAt = new Date();

  // Fetched from the post's own text rather than taken from the client, so a
  // card can only ever describe a link the post actually contains.
  const linkPreview = await resolvePostLinkPreview(
    content,
    formData.get("previewUrl") as string | null,
  );

  await db.insert(posts).values({
    id: postId,
    groupId: profileFeedId(userId),
    userId,
    content,
    images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
    linkPreview,
    // Your own profile has no moderator, so the post is live on arrival.
    status: "approved",
    createdAt,
    approvedAt: createdAt,
  });

  const [owner] = await db
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, userId));

  if (owner) {
    revalidatePath(`/profile/${owner.handle}`);
  }

  return {
    id: postId,
    images: imageUrls,
    linkPreview: parseLinkPreview(linkPreview),
    createdAt,
  };
};
