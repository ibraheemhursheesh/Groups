import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileFeed } from "@/app/profile/[handle]/profile-feed";

const mockCreateProfilePost = vi.fn();
const mockGetProfilePosts = vi.fn();
vi.mock("@/app/actions/profile-posts", () => ({
  createProfilePost: (...args: unknown[]) => mockCreateProfilePost(...args),
  getProfilePosts: (...args: unknown[]) => mockGetProfilePosts(...args),
}));

// The composer compresses picked images before handing them over; the identity
// function keeps that step out of the way of what these tests are about.
vi.mock("browser-image-compression", () => ({
  default: (file: File) => Promise.resolve(file),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

type FeedProps = ComponentProps<typeof ProfileFeed>;

const author: FeedProps["author"] = {
  id: "user-1",
  name: "Ada Lovelace",
  handle: "ada",
  image: null,
};

const existingPost: FeedProps["initialPosts"][number] = {
  id: "post-1",
  userId: "user-1",
  userName: "Ada Lovelace",
  userHandle: "ada",
  userImage: null,
  content: "Notes on the Analytical Engine",
  images: [],
  createdAt: new Date("2024-03-01T10:00:00.000Z"),
};

function renderFeed(overrides: Partial<FeedProps> = {}) {
  return render(
    <ProfileFeed
      author={author}
      isOwner
      initialPosts={[existingPost]}
      initialNextCursor={null}
      {...overrides}
    />,
  );
}

/** Opens the composer and submits `content` through it. */
function composePost(content: string) {
  fireEvent.click(screen.getByRole("button", { name: /new profile post/i }));
  fireEvent.change(
    screen.getByPlaceholderText("Share something on your profile..."),
    { target: { value: content } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom defaults to 1024px, so useIsMobile() resolves to the dialog branch.
  window.innerWidth = 1024;
  mockCreateProfilePost.mockResolvedValue({
    id: "post-2",
    images: [],
    createdAt: new Date(),
  });
});

describe("ProfileFeed", () => {
  it("renders the posts already on the profile", () => {
    renderFeed();

    expect(screen.getByText("Notes on the Analytical Engine")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText(/@ada/)).toBeTruthy();
  });

  it("offers the composer to the owner only", () => {
    const { unmount } = renderFeed();
    expect(
      screen.queryByRole("button", { name: /new profile post/i }),
    ).toBeTruthy();
    unmount();

    renderFeed({ isOwner: false });
    expect(
      screen.queryByRole("button", { name: /new profile post/i }),
    ).toBeNull();
  });

  it("tells an owner and a visitor apart on an empty profile", () => {
    const { unmount } = renderFeed({ initialPosts: [] });
    expect(screen.getByText("You haven't posted yet.")).toBeTruthy();
    unmount();

    renderFeed({ initialPosts: [], isOwner: false });
    expect(screen.getByText("No posts yet.")).toBeTruthy();
  });

  it("shows the post before the server confirms it, then settles it", async () => {
    renderFeed();

    composePost("Hello from my profile");

    // On screen immediately, marked as still in flight.
    expect(screen.getByText("Hello from my profile")).toBeTruthy();
    expect(screen.getByText(/Posting\.\.\./)).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText(/Posting\.\.\./)).toBeNull();
    });
    expect(screen.getByText("Hello from my profile")).toBeTruthy();

    const formData = mockCreateProfilePost.mock.calls[0][0] as FormData;
    expect(formData.get("content")).toBe("Hello from my profile");
    // The blob previews are for the optimistic copy only — the server never
    // needs them.
    expect(formData.get("previewUrls")).toBeNull();
  });

  describe("when the action fails", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockCreateProfilePost.mockRejectedValue(new Error("no connection"));
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it("takes the optimistic post back and says so", async () => {
      renderFeed();

      composePost("This one never lands");

      await waitFor(() => {
        expect(
          screen.getByText("Could not publish your post. Please try again."),
        ).toBeTruthy();
      });
      expect(screen.queryByText("This one never lands")).toBeNull();
      // The post that was already there is untouched.
      expect(screen.getByText("Notes on the Analytical Engine")).toBeTruthy();
    });
  });

  it("appends the next page and drops the button at the end of the feed", async () => {
    const cursor = "2024-03-01T10:00:00.000Z";
    mockGetProfilePosts.mockResolvedValue({
      posts: [
        {
          ...existingPost,
          id: "post-0",
          content: "An older post",
          createdAt: new Date("2024-02-01T10:00:00.000Z"),
        },
      ],
      nextCursor: null,
    });

    renderFeed({ initialNextCursor: cursor });

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(screen.getByText("An older post")).toBeTruthy();
    });
    expect(mockGetProfilePosts).toHaveBeenCalledWith("ada", cursor);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
