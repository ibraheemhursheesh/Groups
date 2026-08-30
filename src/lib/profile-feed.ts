// Profile posts share the `posts` table with group posts, keyed by a synthetic
// feed id in place of an organization id. `posts.group_id` is a plain text
// column with no foreign key, and group ids are uuid-shaped, so a prefixed id
// can never collide with a real group — and every group query filters on an
// exact id, so profile posts stay out of group feeds.
const PROFILE_FEED_PREFIX = "profile:";

export function profileFeedId(userId: string): string {
  return `${PROFILE_FEED_PREFIX}${userId}`;
}
