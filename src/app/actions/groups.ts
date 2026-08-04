"use server";

import { auth } from "@/app/lib/auth";
import { db } from "@/index";
import { joinRequests, posts, user, organization, member as memberTable } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  const pendingRequests = currentMember?.role === "admin"
    ? await db
        .select({ id: joinRequests.id, userId: joinRequests.userId, userName: user.name, userImage: user.image, createdAt: joinRequests.createdAt })
        .from(joinRequests)
        .where(eq(joinRequests.groupId, groupId))
        .leftJoin(user, eq(joinRequests.userId, user.id))
    : [];

  const pendingPosts = currentMember?.role === "admin"
    ? await db
        .select({ id: posts.id, userId: posts.userId, userName: user.name, content: posts.content, imageUrl: posts.imageUrl, createdAt: posts.createdAt })
        .from(posts)
        .where(and(eq(posts.groupId, groupId), eq(posts.status, "pending")))
        .leftJoin(user, eq(posts.userId, user.id))
    : [];

  const approvedPosts = currentMember
    ? await db
        .select({ id: posts.id, userId: posts.userId, userName: user.name, content: posts.content, imageUrl: posts.imageUrl, createdAt: posts.createdAt })
        .from(posts)
        .where(and(eq(posts.groupId, groupId), eq(posts.status, "approved")))
        .leftJoin(user, eq(posts.userId, user.id))
        .orderBy(desc(posts.createdAt))
    : [];

  const myPendingPosts = currentMember
    ? await db
        .select({
          id: posts.id,
          content: posts.content,
          imageUrl: posts.imageUrl,
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

  return {
    organization: orgResult || org,
    currentMember: currentMember || null,
    joinRequest: joinRequest || null,
    pendingRequests,
    pendingPosts,
    approvedPosts,
    myPendingPosts,
  };
};

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
  const imageFile = formData.get("image") as File | null;

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
  let imageUrl: string | null = null;

  if (imageFile && imageFile.size > 0) {
    const ext = imageFile.name.split(".").pop() || "png";
    const path = `${groupId}/posts/${postId}.${ext}`;
    const uploadResult = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      });
    if (!uploadResult.error) {
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      imageUrl = data.publicUrl;
    }
  }

  await db.insert(posts).values({
    id: postId,
    groupId,
    userId: session.user.id,
    content: content.trim(),
    imageUrl,
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
