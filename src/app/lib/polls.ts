import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/index";
import { pollVotes } from "@/db/schema";
import { buildPollResults, parsePoll, type PollResults } from "@/lib/poll";

/**
 * Hydrates a page of posts' polls in two queries, no matter how many polls are
 * on the page: one grouped tally for everyone's votes, one for the viewer's
 * own. Rows without a poll cost nothing.
 *
 * The viewer's choice is fetched here rather than derived from the tally
 * because it is personal — it never rides on the realtime broadcast, and the
 * feed is the only place that knows it.
 */
export async function loadPollResults(
  rows: Array<{ id: string; poll: unknown }>,
  viewerId: string | null,
): Promise<Map<string, PollResults>> {
  const polls = new Map<string, ReturnType<typeof parsePoll>>();
  for (const row of rows) {
    const poll = parsePoll(row.poll);
    if (poll) polls.set(row.id, poll);
  }

  const results = new Map<string, PollResults>();
  if (polls.size === 0) return results;

  const postIds = [...polls.keys()];

  const [tallies, ownVotes] = await Promise.all([
    db
      .select({
        postId: pollVotes.postId,
        optionId: pollVotes.optionId,
        count: count(),
      })
      .from(pollVotes)
      .where(inArray(pollVotes.postId, postIds))
      .groupBy(pollVotes.postId, pollVotes.optionId),
    viewerId
      ? db
          .select({ postId: pollVotes.postId, optionId: pollVotes.optionId })
          .from(pollVotes)
          .where(
            and(
              eq(pollVotes.userId, viewerId),
              inArray(pollVotes.postId, postIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  const countsByPost = new Map<string, Map<string, number>>();
  for (const tally of tallies) {
    let counts = countsByPost.get(tally.postId);
    if (!counts) {
      counts = new Map();
      countsByPost.set(tally.postId, counts);
    }
    counts.set(tally.optionId, Number(tally.count));
  }

  const ownVoteByPost = new Map(ownVotes.map((v) => [v.postId, v.optionId]));

  for (const [postId, poll] of polls) {
    results.set(
      postId,
      buildPollResults(
        poll!,
        countsByPost.get(postId) ?? new Map(),
        ownVoteByPost.get(postId) ?? null,
      ),
    );
  }

  return results;
}

/** The tally for one poll, as the vote action broadcasts it. */
export async function loadPollCounts(
  postId: string,
): Promise<Record<string, number>> {
  const tallies = await db
    .select({ optionId: pollVotes.optionId, count: count() })
    .from(pollVotes)
    .where(eq(pollVotes.postId, postId))
    .groupBy(pollVotes.optionId);

  return Object.fromEntries(
    tallies.map((tally) => [tally.optionId, Number(tally.count)]),
  );
}
