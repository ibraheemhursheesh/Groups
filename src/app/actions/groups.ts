"use server";

import { auth } from "@/app/lib/auth";
import { db } from "@/index";
import { joinRequests, posts, user, organization, member as memberTable } from "@/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { uploadGroupCover, supabase, STORAGE_BUCKET } from "@/app/lib/supabase";

export const createGroup = async (formData: FormData) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const coverFile = formData.get("cover") as File | null;

  if (!name || name.trim().length === 0) {
    throw new Error("Group name is required");
  }

  const groupId = crypto.randomUUID();

  let logo: string | undefined;
  if (coverFile && coverFile.size > 0) {
    logo = (await uploadGroupCover(coverFile, groupId)) ?? undefined;
  }

  const result = await auth.api.createOrganization({
    body: {
      name: name.trim(),
      slug: name.trim().toLowerCase().replace(/\s+/g, "-") + "-" + crypto.randomUUID().slice(0, 8),
      logo,
      metadata: { description: description?.trim() || "" },
      userId: session.user.id,
    },
  });

  if (!result) {
    throw new Error("Failed to create group");
  }

  redirect(`/groups/${result.id}`);
};

export const listAllGroups = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const allOrgs = await db.select().from(organization);

  return allOrgs;
};

export const getApprovedPosts = async (
  groupId: string,
  cursor?: string,
  limit = 10,
) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const conditions = [eq(posts.groupId, groupId), eq(posts.status, "approved")];
  if (cursor) {
    const cursorDate = new Date(cursor);
    conditions.push(lt(posts.createdAt, cursorDate));
  }

    const result = await db
      .select({
        id: posts.id,
        userId: posts.userId,
        userName: user.name,
        userImage: user.image,
        content: posts.content,
        images: posts.images,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(and(...conditions))
      .leftJoin(user, eq(posts.userId, user.id))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);

  const hasMore = result.length > limit;
  const items = hasMore ? result.slice(0, limit) : result;
  const posts_list = (items as any[]).map((p) => ({
    ...p,
    images: parseImages(p.images),
  }));
  const nextCursor = hasMore
    ? (items[items.length - 1].createdAt?.toISOString() ?? null)
    : null;

  return { posts: posts_list, nextCursor };
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

export const getGroupPageData = async (groupId: string) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, groupId));

  if (!org) {
    return null;
  }

  let orgResult = null;
  try {
    orgResult = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: groupId },
    });
  } catch {
    // User is not a member — orgResult stays null
  }

  const currentMember = orgResult?.members.find(
    (m) => m.userId === session.user.id,
  );

  // Fetch the current user's full profile (including Google photo URL)
  const [currentUserProfile] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, session.user.id));
  const currentUserImage = currentUserProfile?.image ?? null;

  const [joinRequest] = currentMember
    ? []
    : await db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.groupId, groupId),
            eq(joinRequests.userId, session.user.id),
          ),
        );

  const pendingRequests =
    currentMember?.role === "admin"
      ? await db
          .select({
            id: joinRequests.id,
            userId: joinRequests.userId,
            userName: user.name,
            userImage: user.image,
            createdAt: joinRequests.createdAt,
          })
          .from(joinRequests)
          .where(eq(joinRequests.groupId, groupId))
          .leftJoin(user, eq(joinRequests.userId, user.id))
      : [];

  const pendingPosts =
    currentMember?.role === "admin"
      ? await db
          .select({
            id: posts.id,
            userId: posts.userId,
            userName: user.name,
            userImage: user.image,
            content: posts.content,
            images: posts.images,
            createdAt: posts.createdAt,
          })
          .from(posts)
          .where(and(eq(posts.groupId, groupId), eq(posts.status, "pending")))
          .leftJoin(user, eq(posts.userId, user.id))
      : [];

  // Use getApprovedPosts for the initial page to get cursor-based pagination
  const { posts: approvedPosts, nextCursor } = currentMember
    ? await getApprovedPosts(groupId, undefined, 10)
    : { posts: [], nextCursor: null };

  const myPendingPosts = currentMember
    ? await db
        .select({
          id: posts.id,
          content: posts.content,
          images: posts.images,
          createdAt: posts.createdAt,
        })
        .from(posts)
        .where(
          and(
            eq(posts.groupId, groupId),
            eq(posts.userId, session.user.id),
            eq(posts.status, "pending"),
          ),
        )
        .orderBy(desc(posts.createdAt))
    : [];

  const allMembers = (orgResult?.members ?? []).map((m) => ({
    id: m.id,
    userId: m.userId,
    userName: m.user?.name ?? null,
    userImage: m.user?.image ?? null,
    role: m.role as string,
  }));

  return {
    organization: orgResult || org,
    currentMember: currentMember || null,
    currentUserImage,
    joinRequest: joinRequest || null,
    pendingRequests,
    pendingPosts: (pendingPosts as any[]).map((p) => ({ ...p, images: parseImages(p.images) })),
    approvedPosts,
    approvedNextCursor: nextCursor,
    myPendingPosts: (myPendingPosts as any[]).map((p) => ({ ...p, images: parseImages(p.images) })),
    members: allMembers,
  };
};;;;

export const requestToJoin = async (groupId: string) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const [existing] = await db
    .select()
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.groupId, groupId),
        eq(joinRequests.userId, session.user.id),
      ),
    );

  if (existing) {
    return;
  }

  await db.insert(joinRequests).values({
    id: crypto.randomUUID(),
    groupId,
    userId: session.user.id,
    createdAt: new Date(),
  });
};

export const handleJoinRequest = async (requestId: string, groupId: string, action: "approve" | "reject") => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const [jr] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId));

  if (!jr || jr.groupId !== groupId) {
    throw new Error("Invalid request");
  }

  await db.delete(joinRequests).where(eq(joinRequests.id, requestId));

  if (action === "approve") {
    await auth.api.addMember({
      body: {
        organizationId: groupId,
        userId: jr.userId,
        role: "member",
      },
    });
  }
};

export const leaveGroup = async (groupId: string) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const [memberRecord] = await db
    .select()
    .from(memberTable)
    .where(
      and(
        eq(memberTable.organizationId, groupId),
        eq(memberTable.userId, session.user.id),
      ),
    );

  if (!memberRecord) {
    throw new Error("Not a member of this group");
  }

  if (memberRecord.role === "admin") {
    throw new Error("Admins cannot leave. Delete the group instead.");
  }

  await db
    .delete(memberTable)
    .where(
      and(
        eq(memberTable.organizationId, groupId),
        eq(memberTable.userId, session.user.id),
      ),
    );

  await db
    .delete(joinRequests)
    .where(
      and(
        eq(joinRequests.groupId, groupId),
        eq(joinRequests.userId, session.user.id),
      ),
    );
};

export const deleteGroup = async (groupId: string) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  await db.delete(posts).where(eq(posts.groupId, groupId));
  await db.delete(joinRequests).where(eq(joinRequests.groupId, groupId));

  await auth.api.deleteOrganization({
    headers: await headers(),
    body: {
      organizationId: groupId,
    },
  });

  redirect("/");
};

export const createPost = async (formData: FormData) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const groupId = formData.get("groupId") as string;
  const content = formData.get("content") as string;
  const imageFiles = formData.getAll("images") as File[];

  if (!content || content.trim().length === 0) {
    throw new Error("Post content is required");
  }

  const memberResult = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: groupId },
  });

  const currentMember = memberResult?.members.find(
    (m) => m.userId === session.user.id,
  );

  if (!currentMember) {
    throw new Error("Not a member");
  }

  const isAdmin = currentMember.role === "admin";

  const postId = crypto.randomUUID();
  const imageUrls: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${groupId}/posts/${postId}_${i}.${ext}`;
      const uploadResult = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (!uploadResult.error) {
        const { data } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        imageUrls.push(data.publicUrl);
      }
    }
  }

  await db.insert(posts).values({
    id: postId,
    groupId,
    userId: session.user.id,
    content: content.trim(),
    images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
    status: isAdmin ? "approved" : "pending",
    createdAt: new Date(),
  });
}

export const handlePostApproval = async (postId: string, groupId: string, action: "approve" | "reject") => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId));

  if (!post || post.groupId !== groupId) {
    throw new Error("Invalid post");
  }

  if (action === "approve") {
    await db
      .update(posts)
      .set({ status: "approved" })
      .where(eq(posts.id, postId));
  } else {
    await db.delete(posts).where(eq(posts.id, postId));
  }
};

export const deletePost = async (postId: string, groupId: string) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  await db.delete(posts).where(
    and(eq(posts.id, postId), eq(posts.groupId, groupId)),
  );
};

export const kickMember = async (memberId: string, groupId: string) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  await auth.api.removeMember({
    headers: await headers(),
    body: {
      organizationId: groupId,
      memberIdOrEmail: memberId,
    },
  });
};

export const editPost = async (formData: FormData) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const postId = formData.get("postId") as string;
  const groupId = formData.get("groupId") as string;
  const content = formData.get("content") as string;
  const existingUrlsJson = formData.get("existingUrls") as string;
  const existingUrls: string[] = existingUrlsJson ? JSON.parse(existingUrlsJson) : [];
  const newFiles = formData.getAll("newFiles") as File[];

  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.groupId, groupId)));

  if (!post) {
    throw new Error("Post not found");
  }

  if (post.userId !== session.user.id) {
    throw new Error("You can only edit your own posts");
  }

  if (!content || content.trim().length === 0) {
    throw new Error("Post content is required");
  }

  const imageUrls: string[] = [...existingUrls];

  for (const file of newFiles) {
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${groupId}/posts/${postId}_edit_${crypto.randomUUID()}.${ext}`;
      const uploadResult = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (!uploadResult.error) {
        const { data } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        imageUrls.push(data.publicUrl);
      }
    }
  }

  await db
    .update(posts)
    .set({ content: content.trim(), images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null })
    .where(eq(posts.id, postId));

  return imageUrls;
};