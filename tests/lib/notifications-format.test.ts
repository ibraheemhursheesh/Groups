import { describe, expect, it } from "vitest";
import {
  describePostLike,
  summarizeActors,
  MAX_NAMED_ACTORS,
} from "@/lib/notifications-format";

/* The server only ever hands over the few most recent names plus the group's
   real size, so every case here passes at most MAX_NAMED_ACTORS names. */
describe("summarizeActors", () => {
  it("names a single actor", () => {
    expect(summarizeActors(["Person B"], 1)).toBe("Person B");
  });

  it("joins exactly two actors with 'and'", () => {
    expect(summarizeActors(["Person B", "Person C"], 2)).toBe(
      "Person B and Person C",
    );
  });

  it("collapses the tail into 'and N others'", () => {
    expect(summarizeActors(["Person B", "Person C"], 5)).toBe(
      "Person B, Person C and 3 others",
    );
  });

  it("uses the singular when exactly one actor is unnamed", () => {
    expect(summarizeActors(["Person B", "Person C"], 3)).toBe(
      "Person B, Person C and 1 other",
    );
  });

  it("never names more than MAX_NAMED_ACTORS, even if handed more", () => {
    const summary = summarizeActors(["A", "B", "C", "D"], 4);
    expect(summary).toBe("A, B and 2 others");
    expect(MAX_NAMED_ACTORS).toBe(2);
  });

  it("returns nothing for an empty group", () => {
    expect(summarizeActors([], 0)).toBe("");
    expect(summarizeActors([], 7)).toBe("");
  });

  /* A total that lags the names it was fetched with — a like landing between
     the two reads — must not produce "and 0 others" or a negative count. */
  it("degrades gracefully when the total undercounts the names", () => {
    expect(summarizeActors(["Person B", "Person C"], 2)).toBe(
      "Person B and Person C",
    );
    expect(summarizeActors(["Person B", "Person C"], 1)).toBe(
      "Person B and Person C",
    );
  });
});

describe("describePostLike", () => {
  /* The scenario the feature exists for: the author was away while five
     people liked one post, and comes back to a single line. */
  it("describes five likes as one aggregated sentence", () => {
    expect(describePostLike(["Person B", "Person C"], 5)).toBe(
      "Person B, Person C and 3 others liked your post",
    );
  });

  it("describes a lone like", () => {
    expect(describePostLike(["Person B"], 1)).toBe("Person B liked your post");
  });

  it("says nothing when the group has emptied out", () => {
    expect(describePostLike([], 0)).toBe("");
  });
});
