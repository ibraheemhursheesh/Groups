import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { PostList } from "@/app/groups/[id]/post-list";
import type { RealtimeEvent } from "@/lib/realtime";

const mocks = vi.hoisted(() => ({
  toggleLikePost: vi.fn(),
  handlers: [] as Array<(event: RealtimeEvent) => void>,
}));

vi.mock("@/app/actions/groups", () => ({
  toggleLikePost: mocks.toggleLikePost,
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

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    userId: "author-1",
    userName: "Ada Lovelace",
    userHandle: "ada",
    userImage: null,
    content: "Shipping the new feed today",
    images: [],
    likeCount: 4,
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

const pushLike = (overrides: Partial<Extract<RealtimeEvent, { kind: "post-like" }>> = {}) =>
  act(() => {
    for (const handler of mocks.handlers) {
      handler({
        kind: "post-like",
        postId: "post-1",
        groupId: "group-1",
        likeCount: 5,
        actorId: "someone-else",
        ...overrides,
      });
    }
  });

/* The like button is the only one carrying the count as its text. */
const likeCountOf = (postContent: string) => {
  const card = screen.getByText(postContent).closest("div[data-index]");
  return card?.querySelector("button span")?.textContent ?? null;
};

beforeEach(() => {
  mocks.handlers = [];
  mocks.toggleLikePost.mockReset().mockResolvedValue({ liked: true, likeCount: 5 });
});

describe("PostList realtime like counts", () => {
  it("shows the server count on a post someone else just liked", () => {
    renderList([post()]);
    expect(screen.getByText("4")).toBeTruthy();

    pushLike({ likeCount: 5 });

    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.queryByText("4")).toBeNull();
  });

  /* The event carries an authoritative total, so a client that missed one
     still lands on the right number from the next event. */
  it("takes the event's total rather than incrementing", () => {
    renderList([post({ likeCount: 4 })]);

    pushLike({ likeCount: 11 });

    expect(screen.getByText("11")).toBeTruthy();
  });

  it("only touches the post the event names", () => {
    renderList([
      post({ id: "post-1", content: "First post", likeCount: 4 }),
      post({ id: "post-2", content: "Second post", likeCount: 9 }),
    ]);

    pushLike({ postId: "post-1", likeCount: 5 });

    expect(likeCountOf("First post")).toBe("5");
    expect(likeCountOf("Second post")).toBe("9");
  });

  it("ignores an event for a post that is not on screen", () => {
    renderList([post({ likeCount: 4 })]);

    pushLike({ postId: "post-elsewhere", likeCount: 99 });

    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.queryByText("99")).toBeNull();
  });

  /* Whether *this* viewer liked the post is personal — another person's like
     must not flip their heart on. */
  it("leaves the viewer's own liked state alone", () => {
    const { container } = renderList([post({ hasLiked: false, likeCount: 4 })]);

    pushLike({ likeCount: 5 });

    expect(container.querySelector(".fill-red-500")).toBeNull();
  });

  it("keeps the viewer's like showing after a remote update", () => {
    const { container } = renderList([post({ hasLiked: true, likeCount: 4 })]);

    pushLike({ likeCount: 5 });

    expect(container.querySelector(".fill-red-500")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("reconciles an optimistic click with the count the server reports", () => {
    renderList([post({ likeCount: 4 })]);

    const likeButton = screen.getByText("4").closest("button")!;
    act(() => {
      likeButton.click();
    });
    // Optimistic: the click alone bumps it.
    expect(screen.getByText("5")).toBeTruthy();

    // The event for that same like carries the real total, which happens to be
    // higher because someone else got in first.
    pushLike({ likeCount: 6, actorId: "viewer-1" });

    expect(screen.getByText("6")).toBeTruthy();
  });
});
