import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsBell } from "@/components/notifications-bell";
import type { NotificationItem } from "@/app/actions/notifications";
import type { RealtimeEvent } from "@/lib/realtime";

const mocks = vi.hoisted(() => ({
  session: { data: { user: { id: "author-1" } } } as {
    data: { user: { id: string } } | null;
  },
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  // Captures whatever handler the bell registers so a test can push an event
  // through it without standing up a real connection.
  handlers: [] as Array<(event: RealtimeEvent) => void>,
}));

vi.mock("@/app/lib/auth-client", () => ({
  useSession: () => mocks.session,
}));

vi.mock("@/app/actions/notifications", () => ({
  getNotifications: mocks.getNotifications,
  markNotificationsRead: mocks.markNotificationsRead,
}));

vi.mock("@/components/realtime-provider", () => ({
  useRealtimeEvents: (handler: (event: RealtimeEvent) => void) => {
    mocks.handlers[0] = handler;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const pushEvent = (event: RealtimeEvent) => {
  for (const handler of mocks.handlers) handler(event);
};

function aggregatedLike(
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: "notification-1",
    type: "post_like",
    text: "Person B, Person C and 3 others liked your post",
    postId: "post-1",
    groupId: "group-1",
    postPreview: "Shipping the new feed today",
    actorImages: [null, null],
    actorCount: 5,
    read: false,
    updatedAt: new Date("2024-03-01T10:00:00.000Z"),
    ...overrides,
  };
}

const feed = (items: NotificationItem[], unreadCount = items.length) => ({
  items,
  unreadCount,
});

/* Radix opens its menu on pointerdown, not click. */
const openMenu = () => {
  const trigger = screen.getByRole("button");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
};

beforeEach(() => {
  mocks.session = { data: { user: { id: "author-1" } } };
  mocks.handlers = [];
  mocks.getNotifications.mockReset().mockResolvedValue(feed([]));
  mocks.markNotificationsRead.mockReset().mockResolvedValue(undefined);
});

describe("NotificationsBell", () => {
  it("renders nothing when signed out and never touches the server", () => {
    mocks.session = { data: null };

    const { container } = render(<NotificationsBell />);

    expect(container.firstChild).toBeNull();
    expect(mocks.getNotifications).not.toHaveBeenCalled();
  });

  it("shows the unread count on the badge", async () => {
    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 1));

    render(<NotificationsBell />);

    expect(await screen.findByText("1")).toBeTruthy();
  });

  it("caps the badge at 9+", async () => {
    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 42));

    render(<NotificationsBell />);

    expect(await screen.findByText("9+")).toBeTruthy();
  });

  it("shows no badge when everything is read", async () => {
    mocks.getNotifications.mockResolvedValue(
      feed([aggregatedLike({ read: true })], 0),
    );

    render(<NotificationsBell />);

    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalled());
    expect(screen.queryByText("0")).toBeNull();
  });

  /* The whole point of the feature: five people liking one post while the
     author was away is one row, not five. */
  it("lists five likes on a post as a single aggregated row", async () => {
    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 1));

    render(<NotificationsBell />);
    await screen.findByText("1");
    openMenu();

    const rows = await screen.findAllByRole("menuitem");
    expect(rows).toHaveLength(1);
    expect(
      screen.getByText("Person B, Person C and 3 others liked your post"),
    ).toBeTruthy();
  });

  it("links a row to the post it is about", async () => {
    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 1));

    render(<NotificationsBell />);
    await screen.findByText("1");
    openMenu();

    const link = await screen.findByRole("menuitem");
    expect(link.getAttribute("href")).toBe("/groups/group-1/post/post-1");
  });

  it("shows a preview of the post that was liked", async () => {
    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 1));

    render(<NotificationsBell />);
    await screen.findByText("1");
    openMenu();

    expect(await screen.findByText("Shipping the new feed today")).toBeTruthy();
  });

  it("says so when there is nothing to show", async () => {
    render(<NotificationsBell />);
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalled());

    openMenu();

    expect(await screen.findByText("Nothing yet.")).toBeTruthy();
  });

  /* Opening the panel is what closes the aggregation window server-side, so
     the next like starts a fresh group instead of joining a seen one. */
  it("marks notifications read when the panel opens", async () => {
    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 1));
    // Stand in for the server actually closing the groups, so the re-read that
    // follows returns the post-read state rather than the original one.
    mocks.markNotificationsRead.mockImplementation(async () => {
      mocks.getNotifications.mockResolvedValue(
        feed([aggregatedLike({ read: true })], 0),
      );
    });

    render(<NotificationsBell />);
    await screen.findByText("1");
    openMenu();

    await waitFor(() =>
      expect(mocks.markNotificationsRead).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(screen.queryByText("1")).toBeNull());
  });

  /* Marking read on open would otherwise strip the "new" treatment out from
     under the reader mid-glance, so the highlight is frozen at open time. */
  it("keeps rows highlighted while the panel that marked them read is open", async () => {
    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 1));
    mocks.markNotificationsRead.mockImplementation(async () => {
      mocks.getNotifications.mockResolvedValue(
        feed([aggregatedLike({ read: true })], 0),
      );
    });

    render(<NotificationsBell />);
    await screen.findByText("1");
    openMenu();

    await waitFor(() => expect(screen.queryByText("1")).toBeNull());
    const row = await screen.findByRole("menuitem");
    expect(row.className).toContain("bg-accent/50");
  });

  it("does not mark read when there is nothing unread", async () => {
    mocks.getNotifications.mockResolvedValue(
      feed([aggregatedLike({ read: true })], 0),
    );

    render(<NotificationsBell />);
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalled());
    openMenu();

    await screen.findByRole("menuitem");
    expect(mocks.markNotificationsRead).not.toHaveBeenCalled();
  });

  /* The push carries no content, so the bell has to go and re-read the feed
     through the authenticated action. */
  it("re-reads the feed when a notifications-changed event arrives", async () => {
    mocks.getNotifications.mockResolvedValue(feed([], 0));
    render(<NotificationsBell />);
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(1));

    mocks.getNotifications.mockResolvedValue(feed([aggregatedLike()], 1));
    pushEvent({ kind: "notifications-changed" });

    expect(await screen.findByText("1")).toBeTruthy();
    expect(mocks.getNotifications).toHaveBeenCalledTimes(2);
  });

  it("ignores realtime events that are not about notifications", async () => {
    render(<NotificationsBell />);
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(1));

    pushEvent({
      kind: "post-like",
      postId: "post-1",
      groupId: "group-1",
      likeCount: 5,
      actorId: "user-9",
    });

    expect(mocks.getNotifications).toHaveBeenCalledTimes(1);
  });
});
