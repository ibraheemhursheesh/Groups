import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import * as t from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: t.text("id").primaryKey(),
  groupId: t.text("group_id").notNull(),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: t.text("content").notNull(),
  images: t.text("images"),
  status: t.text("status").notNull(),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
  approvedAt: t.timestamp("approved_at", { precision: 6, withTimezone: true }),
  originalPostId: t.text("original_post_id"),
});

export const likes = pgTable(
  "likes",
  {
    id: t.text("id").primaryKey(),
    postId: t
      .text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: t
      .text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: t
      .timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull(),
  },
  // One like per user per post. This is what makes the toggle race-safe —
  // concurrent requests can no longer both insert and inflate the count.
  (table) => [
    t.uniqueIndex("likes_post_id_user_id_unique").on(table.postId, table.userId),
  ],
);

export const joinRequests = pgTable("join_requests", {
  id: t.text("id").primaryKey(),
  groupId: t.text("group_id").notNull(),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
});

export const organization = pgTable("organization", {
  id: t.text("id").primaryKey(),
  name: t.text("name").notNull(),
  slug: t.text("slug").notNull().unique(),
  logo: t.text("logo"),
  metadata: t.text("metadata"),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
});

export const member = pgTable("member", {
  id: t.text("id").primaryKey(),
  organizationId: t
    .text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: t.text("role").notNull(),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
});

export const invitation = pgTable("invitation", {
  id: t.text("id").primaryKey(),
  organizationId: t
    .text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: t.text("email").notNull(),
  role: t.text("role").notNull(),
  status: t.text("status").notNull(),
  expiresAt: t
    .timestamp("expires_at", { precision: 6, withTimezone: true })
    .notNull(),
  inviterId: t
    .text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const user = pgTable("user", {
  id: t.text("id").primaryKey(),
  name: t.text("name").notNull(),
  email: t.varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: t.boolean("email_verified").notNull(),
  image: t.text("image"),
  handle: t.varchar("handle", { length: 20 }).notNull().unique(),
  handleConfirmed: t
    .boolean("handle_confirmed")
    .notNull()
    .default(false),
  isAnonymous: t.boolean("is_anonymous"),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
  updatedAt: t
    .timestamp("updated_at", { precision: 6, withTimezone: true })
    .notNull(),
});

export const session = pgTable("session", {
  id: t.text("id").primaryKey(),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: t.varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: t
    .timestamp("expires_at", { precision: 6, withTimezone: true })
    .notNull(),
  ipAddress: t.text("ip_address"),
  userAgent: t.text("user_agent"),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
  updatedAt: t
    .timestamp("updated_at", { precision: 6, withTimezone: true })
    .notNull(),
});

export const account = pgTable("account", {
  id: t.text("id").primaryKey(),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: t.text("account_id").notNull(),
  providerId: t.text("provider_id").notNull(),
  accessToken: t.text("access_token"),
  refreshToken: t.text("refresh_token"),
  accessTokenExpiresAt: t.timestamp("access_token_expires_at", {
    precision: 6,
    withTimezone: true,
  }),
  refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at", {
    precision: 6,
    withTimezone: true,
  }),
  scope: t.text("scope"),
  idToken: t.text("id_token"),
  password: t.text("password"),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
  updatedAt: t
    .timestamp("updated_at", { precision: 6, withTimezone: true })
    .notNull(),
});

export const comments = pgTable("comments", {
  id: t.text("id").primaryKey(),
  postId: t
    .text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: t.text("content").notNull(),
  parentId: t.text("parent_id"),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
});

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: t.text("id").primaryKey(),
    commentId: t
      .text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: t
      .text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: t
      .timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull(),
  },
  // One like per user per comment — same guarantee as `likes`.
  (table) => [
    t
      .uniqueIndex("comment_likes_comment_id_user_id_unique")
      .on(table.commentId, table.userId),
  ],
);

export const verification = pgTable("verification", {
  id: t.text("id").primaryKey(),
  identifier: t.text("identifier").notNull(),
  value: t.text("value").notNull(),
  expiresAt: t
    .timestamp("expires_at", { precision: 6, withTimezone: true })
    .notNull(),
  createdAt: t
    .timestamp("created_at", { precision: 6, withTimezone: true })
    .notNull(),
  updatedAt: t
    .timestamp("updated_at", { precision: 6, withTimezone: true })
    .notNull(),
});
