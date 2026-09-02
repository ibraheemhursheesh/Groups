import { describe, expect, it } from "vitest";
import {
  applyOptimisticVote,
  applyPollCounts,
  buildPoll,
  buildPollResults,
  MAX_POLL_OPTIONS,
  parsePoll,
  sharePercentages,
  unvotedPollResults,
} from "@/lib/poll";

const ids = () => {
  let n = 0;
  return () => `opt-${++n}`;
};

describe("buildPoll", () => {
  it("mints an id per choice rather than trusting the client", () => {
    expect(buildPoll(JSON.stringify(["Yes", "No"]), ids())).toEqual({
      options: [
        { id: "opt-1", text: "Yes" },
        { id: "opt-2", text: "No" },
      ],
    });
  });

  it("treats an absent or empty poll as an ordinary post", () => {
    expect(buildPoll(null, ids())).toBeNull();
    expect(buildPoll("", ids())).toBeNull();
    expect(buildPoll(JSON.stringify(["  ", ""]), ids())).toBeNull();
  });

  it("drops blank rows the composer left behind", () => {
    const poll = buildPoll(JSON.stringify(["Yes", "  ", "No"]), ids());
    expect(poll?.options.map((o) => o.text)).toEqual(["Yes", "No"]);
  });

  it("rejects a poll with only one real choice", () => {
    expect(() => buildPoll(JSON.stringify(["Yes", " "]), ids())).toThrow(
      /at least 2 choices/,
    );
  });

  it("rejects more choices than a poll can hold", () => {
    const many = Array.from({ length: MAX_POLL_OPTIONS + 1 }, (_, i) => `c${i}`);
    expect(() => buildPoll(JSON.stringify(many), ids())).toThrow(/at most/);
  });

  it("rejects duplicate choices, however they were capitalised", () => {
    expect(() => buildPoll(JSON.stringify(["Yes", "yes"]), ids())).toThrow(
      /must be different/,
    );
  });

  it("rejects a payload that isn't a list of choices", () => {
    expect(() => buildPoll("not json", ids())).toThrow(/malformed/);
    expect(() => buildPoll(JSON.stringify({ a: 1 }), ids())).toThrow(/malformed/);
  });
});

describe("parsePoll", () => {
  it("reads a stored poll back", () => {
    expect(parsePoll('{"options":[{"id":"a","text":"Yes"}]}')).toEqual({
      options: [{ id: "a", text: "Yes" }],
    });
  });

  it("reads a post with no poll as no poll", () => {
    expect(parsePoll(null)).toBeNull();
    expect(parsePoll("")).toBeNull();
  });

  it("refuses malformed json rather than taking a feed down", () => {
    expect(parsePoll("{oops")).toBeNull();
    expect(parsePoll('{"options":[]}')).toBeNull();
    expect(parsePoll('{"options":[{"id":"a"}]}')).toBeNull();
  });
});

describe("sharePercentages", () => {
  it("gives every option zero before anyone votes", () => {
    expect(sharePercentages([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("adds up to 100 where plain rounding would not", () => {
    // Three equal shares round to 33 each and lose a point.
    const shares = sharePercentages([1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares).toEqual([34, 33, 33]);
  });

  it("still adds up to 100 on an awkward split", () => {
    for (const counts of [
      [1, 1, 1, 1, 1, 1],
      [5, 3, 1],
      [7, 7, 1],
      [2, 1],
    ]) {
      expect(sharePercentages(counts).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
});

describe("buildPollResults", () => {
  const poll = {
    options: [
      { id: "a", text: "Tabs" },
      { id: "b", text: "Spaces" },
    ],
  };

  it("joins the tally to the author's option order", () => {
    const results = buildPollResults(poll, { b: 3, a: 1 }, "a");
    expect(results.options.map((o) => [o.text, o.votes, o.percentage])).toEqual([
      ["Tabs", 1, 25],
      ["Spaces", 3, 75],
    ]);
    expect(results.totalVotes).toBe(4);
    expect(results.votedOptionId).toBe("a");
  });

  it("counts an unanswered poll as zero, not as missing", () => {
    const results = buildPollResults(poll, {}, null);
    expect(results.totalVotes).toBe(0);
    expect(results.options.every((o) => o.votes === 0 && o.percentage === 0)).toBe(
      true,
    );
  });

  it("ignores a vote for an option that no longer exists", () => {
    expect(buildPollResults(poll, { a: 1 }, "gone").votedOptionId).toBeNull();
  });
});

describe("unvotedPollResults", () => {
  it("shows a pending poll's choices with an empty tally", () => {
    const results = unvotedPollResults('{"options":[{"id":"a","text":"Yes"}]}');
    expect(results?.totalVotes).toBe(0);
    expect(results?.votedOptionId).toBeNull();
  });

  it("is nothing at all for a post that isn't a poll", () => {
    expect(unvotedPollResults(null)).toBeNull();
  });
});

describe("applyOptimisticVote", () => {
  const results = buildPollResults(
    { options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }] },
    { a: 1, b: 1 },
    null,
  );

  it("counts a first vote right away", () => {
    const next = applyOptimisticVote(results, "a");
    expect(next.options.map((o) => o.votes)).toEqual([2, 1]);
    expect(next.totalVotes).toBe(3);
    expect(next.votedOptionId).toBe("a");
  });

  it("moves a vote rather than adding a second one", () => {
    const voted = applyOptimisticVote(results, "a");
    const moved = applyOptimisticVote(voted, "b");
    expect(moved.options.map((o) => o.votes)).toEqual([1, 2]);
    expect(moved.totalVotes).toBe(3);
    expect(moved.votedOptionId).toBe("b");
  });

  it("is a no-op for the choice already held — there is no unvote", () => {
    const voted = applyOptimisticVote(results, "a");
    expect(applyOptimisticVote(voted, "a")).toBe(voted);
  });

  it("ignores a choice the poll never offered", () => {
    expect(applyOptimisticVote(results, "nope")).toBe(results);
  });
});

describe("applyPollCounts", () => {
  const voted = buildPollResults(
    { options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }] },
    { a: 1 },
    "a",
  );

  it("keeps the viewer's own choice when someone else votes", () => {
    // The broadcast carries the tally, never who the viewer picked.
    const next = applyPollCounts(voted, { a: 1, b: 4 });
    expect(next.votedOptionId).toBe("a");
    expect(next.options.map((o) => o.votes)).toEqual([1, 4]);
    expect(next.totalVotes).toBe(5);
  });

  it("takes the server's word on the viewer's own choice when given", () => {
    expect(applyPollCounts(voted, { b: 1 }, "b").votedOptionId).toBe("b");
  });
});
