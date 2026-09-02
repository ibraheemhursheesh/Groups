// One definition of what a poll *is*, shared by the composer that builds one,
// the server that stores and counts it, and the block that renders the result.
// Keeping the shape here is what stops the three from disagreeing about which
// option a vote belongs to.

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 6;
export const MAX_POLL_OPTION_LENGTH = 80;

export type PollOption = { id: string; text: string };

/** What is stored on the post. The question is the post's own content. */
export type Poll = { options: PollOption[] };

export type PollOptionResult = PollOption & {
  votes: number;
  /** Whole percent of the total. The set always sums to 100 once anyone votes. */
  percentage: number;
};

/** What a feed renders: the options, the tally, and where the viewer stands. */
export type PollResults = {
  options: PollOptionResult[];
  totalVotes: number;
  votedOptionId: string | null;
};

/**
 * Reads a poll back out of storage. Deliberately forgiving — a row that
 * predates this feature, or one whose json got mangled, renders as "not a
 * poll" rather than taking a feed down with it.
 */
export function parsePoll(value: unknown): Poll | null {
  if (!value) return null;

  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof raw !== "object" || raw === null) return null;
  const options = (raw as { options?: unknown }).options;
  if (!Array.isArray(options) || options.length === 0) return null;

  const parsed: PollOption[] = [];
  for (const option of options) {
    if (typeof option !== "object" || option === null) return null;
    const { id, text } = option as { id?: unknown; text?: unknown };
    if (typeof id !== "string" || typeof text !== "string") return null;
    if (!id || !text) return null;
    parsed.push({ id, text });
  }

  return { options: parsed };
}

/**
 * Turns whatever the composer sent into a poll, or throws. Option ids are
 * minted here rather than accepted from the request, so a vote can only ever
 * name an option the server itself wrote.
 *
 * Returns null when the request carries no poll at all — that is a normal
 * post, not an error.
 */
export function buildPoll(value: unknown, makeId: () => string): Poll | null {
  if (value === null || value === undefined || value === "") return null;

  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new Error("Poll options are malformed");
    }
  }

  if (!Array.isArray(raw)) throw new Error("Poll options are malformed");

  const texts = raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((text) => text.length > 0)
    .map((text) => text.slice(0, MAX_POLL_OPTION_LENGTH));

  if (texts.length === 0) return null;

  if (texts.length < MIN_POLL_OPTIONS) {
    throw new Error(`A poll needs at least ${MIN_POLL_OPTIONS} choices`);
  }
  if (texts.length > MAX_POLL_OPTIONS) {
    throw new Error(`A poll can have at most ${MAX_POLL_OPTIONS} choices`);
  }

  const seen = new Set<string>();
  for (const text of texts) {
    const key = text.toLowerCase();
    if (seen.has(key)) throw new Error("Poll choices must be different");
    seen.add(key);
  }

  return { options: texts.map((text) => ({ id: makeId(), text })) };
}

/**
 * Whole-percent shares that add up to 100. Rounding each share on its own
 * gives sets like 33/33/33, so the remainder goes to the options with the
 * largest fractional part — the largest-remainder method.
 */
export function sharePercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((value) => (value / total) * 100);
  const shares = exact.map(Math.floor);
  let remainder = 100 - shares.reduce((sum, value) => sum + value, 0);

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    // Ties break on position so the same tally always renders the same way.
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < byFraction.length && remainder > 0; i++, remainder--) {
    shares[byFraction[i].index] += 1;
  }

  return shares;
}

/** Joins a stored poll to a tally. The option order is the author's, always. */
export function buildPollResults(
  poll: Poll,
  counts: Map<string, number> | Record<string, number>,
  votedOptionId: string | null,
): PollResults {
  const countOf = (id: string) =>
    counts instanceof Map ? (counts.get(id) ?? 0) : (counts[id] ?? 0);

  const votes = poll.options.map((option) => countOf(option.id));
  const percentages = sharePercentages(votes);

  return {
    options: poll.options.map((option, index) => ({
      ...option,
      votes: votes[index],
      percentage: percentages[index],
    })),
    totalVotes: votes.reduce((sum, value) => sum + value, 0),
    // A vote for an option that no longer exists reads as "not voted".
    votedOptionId:
      votedOptionId && poll.options.some((o) => o.id === votedOptionId)
        ? votedOptionId
        : null,
  };
}

/**
 * A poll nobody can have answered yet — what a post still awaiting approval
 * shows. Rendering it through the same shape as a live poll is what lets an
 * approved post keep its identity when it moves into the feed.
 */
export function unvotedPollResults(value: unknown): PollResults | null {
  const poll = parsePoll(value);
  return poll ? buildPollResults(poll, {}, null) : null;
}

/**
 * The viewer's own click, applied before the server answers. Voting again for
 * the option you already picked is a no-op — a poll records a choice, and
 * there is no "unvote".
 */
export function applyOptimisticVote(
  results: PollResults,
  optionId: string,
): PollResults {
  if (results.votedOptionId === optionId) return results;
  if (!results.options.some((option) => option.id === optionId)) return results;

  const previous = results.votedOptionId;
  const votes = results.options.map((option) => {
    let count = option.votes;
    if (option.id === optionId) count += 1;
    if (previous && option.id === previous) count -= 1;
    return Math.max(count, 0);
  });
  const percentages = sharePercentages(votes);

  return {
    options: results.options.map((option, index) => ({
      ...option,
      votes: votes[index],
      percentage: percentages[index],
    })),
    totalVotes: votes.reduce((sum, value) => sum + value, 0),
    votedOptionId: optionId,
  };
}

/**
 * Replaces the tally with an authoritative one from the server, keeping the
 * viewer's own choice — which is personal and never travels on the broadcast.
 */
export function applyPollCounts(
  results: PollResults,
  counts: Record<string, number>,
  votedOptionId: string | null = results.votedOptionId,
): PollResults {
  return buildPollResults(
    { options: results.options.map(({ id, text }) => ({ id, text })) },
    counts,
    votedOptionId,
  );
}
