// How many actors get named before the rest collapse into "and N others".
export const MAX_NAMED_ACTORS = 2;

/**
 * Turns an aggregation group into the phrase that fronts a notification.
 *
 * `names` holds the most recent actors (at most `MAX_NAMED_ACTORS`); `total` is
 * how many people are in the group overall, which is what the "others" count is
 * derived from. Five likes with two names in hand reads
 * "Person B, Person C and 3 others".
 */
export function summarizeActors(names: string[], total: number): string {
  const named = names.slice(0, MAX_NAMED_ACTORS);
  if (named.length === 0 || total <= 0) return "";
  if (named.length === 1 && total <= 1) return named[0];
  if (named.length >= 2 && total <= 2) return `${named[0]} and ${named[1]}`;

  const others = total - named.length;
  if (others <= 0) {
    return named.length >= 2 ? `${named[0]} and ${named[1]}` : named[0];
  }
  return `${named.join(", ")} and ${others} ${
    others === 1 ? "other" : "others"
  }`;
}

export function describePostLike(names: string[], total: number): string {
  const who = summarizeActors(names, total);
  return who ? `${who} liked your post` : "";
}
