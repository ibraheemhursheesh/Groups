import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareDialog } from "@/app/groups/[id]/share-dialog";

type OriginalPost = ComponentProps<typeof ShareDialog>["originalPost"];

const CREATED_AT = new Date("2024-03-01T10:00:00.000Z");

const originalPost: OriginalPost = {
  userName: "Ada Lovelace",
  userImage: "https://cdn.example.com/ada.jpg",
  content: "Original post body",
  images: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"],
  createdAt: CREATED_AT,
};

function renderDialog(overrides: Partial<OriginalPost> = {}) {
  const onShare = vi.fn();
  const utils = render(
    <ShareDialog
      originalPostId="post-1"
      originalPost={{ ...originalPost, ...overrides }}
      groupId="group-1"
      onShare={onShare}
    />,
  );
  // The trigger is the only button rendered before the dialog opens.
  const trigger = utils.container.querySelector("button")!;
  return { ...utils, onShare, trigger };
}

/** Reads the FormData handed to onShare into a plain object. */
function sharedFields(onShare: ReturnType<typeof vi.fn>) {
  const formData = onShare.mock.calls[0][0] as FormData;
  return Object.fromEntries(formData.entries());
}

beforeEach(() => {
  // jsdom defaults to 1024px, so useIsMobile() resolves to the desktop branch.
  window.innerWidth = 1024;
});

describe("ShareDialog", () => {
  it("keeps the dialog closed until the trigger is clicked", () => {
    const { trigger } = renderDialog();

    expect(screen.queryByText("Share post")).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByText("Share post")).toBeTruthy();
    expect(
      screen.getByText("Add your thoughts and share this post with the group."),
    ).toBeTruthy();
  });

  it("previews the original post's author, time and content", () => {
    const { trigger } = renderDialog({
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    fireEvent.click(trigger);

    expect(screen.getByText("Ada Lovelace · 5m")).toBeTruthy();
    expect(screen.getByText("Original post body")).toBeTruthy();
  });

  it("previews the original author's avatar when they have one", () => {
    const { trigger } = renderDialog();
    fireEvent.click(trigger);

    const avatar = document.querySelector(
      'img[src="https://cdn.example.com/ada.jpg"]',
    );
    expect(avatar).not.toBeNull();
  });

  it("falls back to the author's initial when they have no avatar", () => {
    const { trigger } = renderDialog({ userImage: null });
    fireEvent.click(trigger);

    expect(
      document.querySelector('img[src="https://cdn.example.com/ada.jpg"]'),
    ).toBeNull();
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("submits every original-post field alongside the comment", () => {
    const { trigger, onShare } = renderDialog();
    fireEvent.click(trigger);

    fireEvent.change(screen.getByPlaceholderText("Add a comment..."), {
      target: { value: "Worth a read" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(sharedFields(onShare)).toEqual({
      groupId: "group-1",
      content: "Worth a read",
      originalPostId: "post-1",
      origContent: "Original post body",
      origImages: JSON.stringify([
        "https://cdn.example.com/1.jpg",
        "https://cdn.example.com/2.jpg",
      ]),
      origUserName: "Ada Lovelace",
      origUserImage: "https://cdn.example.com/ada.jpg",
      origCreatedAt: CREATED_AT.toISOString(),
    });
  });

  it("shares with an empty comment when nothing is typed", () => {
    const { trigger, onShare } = renderDialog();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(sharedFields(onShare).content).toBe("");
  });

  it("sends empty strings rather than 'null' for a missing name and avatar", () => {
    const { trigger, onShare } = renderDialog({
      userName: null,
      userImage: null,
    });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    const fields = sharedFields(onShare);
    expect(fields.origUserName).toBe("");
    expect(fields.origUserImage).toBe("");
  });

  it("serialises an empty image list as an empty JSON array", () => {
    const { trigger, onShare } = renderDialog({ images: [] });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(sharedFields(onShare).origImages).toBe("[]");
  });

  it("closes the dialog and clears the comment after sharing", () => {
    const { trigger } = renderDialog();
    fireEvent.click(trigger);

    fireEvent.change(screen.getByPlaceholderText("Add a comment..."), {
      target: { value: "Worth a read" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.queryByText("Share post")).toBeNull();

    fireEvent.click(trigger);
    expect(
      screen.getByPlaceholderText<HTMLTextAreaElement>("Add a comment...").value,
    ).toBe("");
  });

  it("can be shared repeatedly, sending the second comment on the second share", () => {
    const { trigger, onShare } = renderDialog();

    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText("Add a comment..."), {
      target: { value: "first" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText("Add a comment..."), {
      target: { value: "second" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(onShare).toHaveBeenCalledTimes(2);
    expect(
      Object.fromEntries((onShare.mock.calls[1][0] as FormData).entries())
        .content,
    ).toBe("second");
  });

  it("renders the drawer instead of the dialog on mobile widths", () => {
    window.innerWidth = 500;
    const { trigger } = renderDialog();

    fireEvent.click(trigger);

    // The drawer heading replaces the dialog's title/description pair.
    expect(screen.getByText("Share post")).toBeTruthy();
    expect(
      screen.queryByText("Add your thoughts and share this post with the group."),
    ).toBeNull();
    expect(screen.getByPlaceholderText("Add a comment...")).toBeTruthy();
  });
});
