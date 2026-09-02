import { render, screen, act, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { PostList } from "@/app/groups/[id]/post-list";
import { buildPollResults } from "@/lib/poll";
import type { RealtimeEvent } from "@/lib/realtime";

const mocks = vi.hoisted(() => ({
  toggleLikePost: vi.fn(),
  votePoll: vi.fn(),
  handlers: [] as Array<(event: RealtimeEvent) => void>,
}));

vi.mock("@/app/actions/groups", () => ({
  toggleLikePost: mocks.toggleLikePost,
  votePoll: mocks.votePoll,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/realtime-provider", () => ({
  useRealtimeEvents: (handler: (event: RealtimeEvent) => void) => {
    mocks.handlers[0] = handler;
  },
}));

type Post = ComponentProps<typeof PostList>["posts"][number];

const pollOf = (counts: Record<string, number>, voted: string | null = null) =>
  buildPollResults(
    {
      options: [
        { id: "a", text: "Tabs" },
        { id: "b", text: "Spaces" },
      ],
    },
    counts,
    voted,
  );

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    userId: "author-1",
    userName: "Ada Lovelace",
    userHandle: "ada",
    userImage: null,
    content: "Tabs or spaces?",
    images: [],
    linkPreview: null,
    poll: pollOf({ a: 1, b: 1 }),
    likeCount: 0,
    hasLiked: false,
    originalPostId: null,
    origContent: null,
    origImages: null,
    origUserName: null,
    origUserImage: null,
    origCreatedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function renderList(posts: Post[]) {
  return render(
    <PostList
      posts={posts}
      currentUserId="viewer-1"
      isAdmin={false}
      groupId="group-1"
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onShare={vi.fn()}
    />,
  );
}

const choice = (text: string) =>
  screen.getByRole("button", { name: new RegExp(text) });

const pushVote = (
  overrides: Partial<Extract<RealtimeEvent, { kind: "poll-vote" }>> = {},
) =>
  act(() => {
    for (const handler of mocks.handlers) {
      handler({
        kind: "poll-vote",
        postId: "post-1",
        groupId: "group-1",
        counts: { a: 1, b: 1 },
        actorId: "someone-else",
        ...overrides,
      });
    }
  });

/** Lets the promise `votePoll` returned settle into the component. */
const flush = () => act(async () => {});

beforeEach(() => {
  mocks.handlers = [];
  mocks.votePoll
    .mockReset()
    .mockResolvedValue({ counts: { a: 1, b: 2 }, votedOptionId: "b" });
});

describe("PostList polls", () => {
  it("renders the tally that came with the post", () => {
    renderList([post({ poll: pollOf({ a: 3, b: 1 }) })]);

    expect(choice("Tabs").textContent).toContain("75%");
    expect(choice("Tabs").textContent).toContain("3 votes");
    expect(choice("Spaces").textContent).toContain("25%");
  });

  it("counts the viewer's own vote before the server answers", async () => {
    renderList([post({ poll: pollOf({ a: 1, b: 1 }) })]);

    fireEvent.click(choice("Spaces"));

    expect(mocks.votePoll).toHaveBeenCalledWith("post-1", "b");
    expect(choice("Spaces").textContent).toContain("2 votes");
    expect(choice("Spaces").textContent).toContain("67%");
    await flush();
  });

  it("puts the tally back when the server refuses the vote", async () => {
    mocks.votePoll.mockRejectedValue(new Error("Not a member"));
    renderList([post({ poll: pollOf({ a: 1, b: 1 }) })]);

    fireEvent.click(choice("Spaces"));
    await flush();

    expect(choice("Spaces").textContent).toContain("1 vote");
    expect(choice("Spaces").getAttribute("aria-pressed")).toBe("false");
  });

  /* The event carries the whole tally, so a client that missed one still
     lands on the right numbers from the next event. */
  it("takes the broadcast tally when someone else votes", () => {
    renderList([post({ poll: pollOf({ a: 1, b: 1 }) })]);

    pushVote({ counts: { a: 1, b: 9 } });

    expect(choice("Spaces").textContent).toContain("9 votes");
    expect(choice("Spaces").textContent).toContain("90%");
  });

  /* Which option *this* viewer picked is personal and never rides on the
     broadcast — someone else's vote must not move their check mark. */
  it("keeps the viewer's own choice through a remote vote", () => {
    renderList([post({ poll: pollOf({ a: 1, b: 1 }, "a") })]);

    pushVote({ counts: { a: 1, b: 4 } });

    expect(choice("Tabs").getAttribute("aria-pressed")).toBe("true");
    expect(choice("Spaces").textContent).toContain("4 votes");
  });

  it("only touches the poll the event names", () => {
    renderList([
      post({ id: "post-1", content: "Tabs or spaces?" }),
      post({
        id: "post-2",
        content: "Second poll",
        poll: pollOf({ a: 5, b: 5 }),
      }),
    ]);

    pushVote({ postId: "post-2", counts: { a: 5, b: 15 } });

    const second = screen
      .getByText("Second poll")
      .closest("div[data-index]")!;
    expect(second.textContent).toContain("15 votes");
    expect(second.textContent).toContain("20 votes");
  });

  it("leaves an ordinary post without a poll alone", () => {
    renderList([post({ poll: null })]);

    expect(screen.queryByRole("button", { name: /Tabs/ })).toBeNull();
  });
});
