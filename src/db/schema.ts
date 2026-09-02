import { sql } from "drizzle-orm";
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
  // The Open Graph card for the first link in the post, as JSON. Snapshotted
  // at write time so a feed never has to fetch anything to render.
  linkPreview: t.text("link_preview"),
  // The poll's choices as JSON, or null on an ordinary post. The question is
  // the post's own `content`, so a poll reads, truncates and links like any
  // other post. Votes live in `pollVotes` — no running tally is kept here.
  poll: t.text("poll"),
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

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: t.text("id").primaryKey(),
    postId: t
      .text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // The id of an option inside `posts.poll`. A plain string rather than a
    // foreign key, because the options themselves live in json on the post.
    optionId: t.text("option_id").notNull(),
    userId: t
      .text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: t
      .timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull(),
    updatedAt: t
      .timestamp("updated_at", { precision: 6, withTimezone: true })
      .notNull(),
  },
  // One vote per person per poll — changing your mind updates this row rather
  // than adding another. That is what makes a tally a plain count, with no way
  // for concurrent clicks to count one voter twice.
  (table) => [
    t
      .uniqueIndex("poll_votes_post_id_user_id_unique")
      .on(table.postId, table.userId),
    t.index("poll_votes_post_id_option_id_idx").on(table.postId, table.optionId),
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

// A notification is an *aggregation group*, not a single event. All the likes
// on one post collapse into one row, and the people who did the liking hang off
// it in `notificationActors`. The group stays open while unread; reading it
// closes it, so likes that arrive afterwards start a fresh group instead of
// silently reviving one the user already dismissed.
export const notifications = pgTable(
  "notifications",
  {
    id: t.text("id").primaryKey(),
    recipientId: t
      .text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "post_like" today. Comments and mentions slot in here without a schema
    // change, which is why the target is a bare id rather than a post FK.
    type: t.text("type").notNull(),
    targetId: t.text("target_id").notNull(),
    createdAt: t
      .timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull(),
    // Bumped every time an actor joins the group, so the newest activity sorts
    // to the top even when the group itself is old.
    updatedAt: t
      .timestamp("updated_at", { precision: 6, withTimezone: true })
      .notNull(),
    readAt: t.timestamp("read_at", { precision: 6, withTimezone: true }),
  },
  (table) => [
    // The partial unique index is what makes aggregation race-safe: concurrent
    // likes on the same post contend on one open row and merge, rather than
    // each creating its own notification.
    t
      .uniqueIndex("notifications_open_group_unique")
      .on(table.recipientId, table.type, table.targetId)
      .where(sql`${table.readAt} is null`),
    t
      .index("notifications_recipient_updated_idx")
      .on(table.recipientId, table.updatedAt.desc()),
  ],
);

export const notificationActors = pgTable(
  "notification_actors",
  {
    id: t.text("id").primaryKey(),
    notificationId: t
      .text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    actorId: t
      .text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: t
      .timestamp("created_at", { precision: 6, withTimezone: true })
      .notNull(),
  },
  // One row per person per group — liking, unliking and liking again moves you
  // to the front of the group rather than counting you twice.
  (table) => [
    t
      .uniqueIndex("notification_actors_notification_actor_unique")
      .on(table.notificationId, table.actorId),
    t
      .index("notification_actors_notification_created_idx")
      .on(table.notificationId, table.createdAt.desc()),
  ],
);
