import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfilePostForm } from "@/app/profile/[handle]/profile-post-form";
import type { LinkPreview } from "@/lib/links";

const mockGetLinkPreview = vi.fn();
vi.mock("@/app/actions/link-preview", () => ({
  getLinkPreview: (...args: unknown[]) => mockGetLinkPreview(...args),
}));

vi.mock("browser-image-compression", () => ({
  default: (file: File) => Promise.resolve(file),
}));

const preview: LinkPreview = {
  url: "https://example.com/article",
  title: "An article worth reading",
  description: "A short summary.",
  image: null,
  siteName: "Example",
};

function renderForm() {
  const onOptimisticSubmit = vi.fn();
  render(<ProfilePostForm onOptimisticSubmit={onOptimisticSubmit} />);
  const textarea = screen.getByPlaceholderText(
    "Share something on your profile...",
  );
  return { onOptimisticSubmit, textarea };
}

function submitted(onOptimisticSubmit: ReturnType<typeof vi.fn>) {
  return onOptimisticSubmit.mock.calls[0][0] as FormData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLinkPreview.mockResolvedValue(preview);
});

describe("ProfilePostForm link previews", () => {
  it("previews the first link as it is typed", async () => {
    const { textarea } = renderForm();

    fireEvent.change(textarea, {
      target: { value: "look at https://example.com/article" },
    });

    await waitFor(() => {
      expect(screen.getByText("An article worth reading")).toBeTruthy();
    });
    expect(mockGetLinkPreview).toHaveBeenCalledWith(
      "https://example.com/article",
    );
  });

  it("asks for one lookup after a burst of typing, not one per keystroke", async () => {
    const { textarea } = renderForm();

    for (const value of [
      "https://exa",
      "https://example",
      "https://example.com/article",
    ]) {
      fireEvent.change(textarea, { target: { value } });
    }

    await waitFor(() => {
      expect(screen.getByText("An article worth reading")).toBeTruthy();
    });
    expect(mockGetLinkPreview).toHaveBeenCalledTimes(1);
  });

  it("submits the link for the server to fetch, plus the card it already has", async () => {
    const { onOptimisticSubmit, textarea } = renderForm();

    fireEvent.change(textarea, {
      target: { value: "look at https://example.com/article" },
    });
    await waitFor(() => {
      expect(screen.getByText("An article worth reading")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    const formData = submitted(onOptimisticSubmit);
    expect(formData.get("previewUrl")).toBe("https://example.com/article");
    expect(JSON.parse(formData.get("previewData") as string)).toEqual(preview);
  });

  it("sends an empty link once the card is dismissed", async () => {
    const { onOptimisticSubmit, textarea } = renderForm();

    fireEvent.change(textarea, {
      target: { value: "look at https://example.com/article" },
    });
    await waitFor(() => {
      expect(screen.getByText("An article worth reading")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Remove link preview"));
    expect(screen.queryByText("An article worth reading")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    const formData = submitted(onOptimisticSubmit);
    // Empty is how the composer says "no card", as opposed to an absent field,
    // which lets the server pick the link itself.
    expect(formData.get("previewUrl")).toBe("");
    expect(formData.get("previewData")).toBeNull();
  });

  it("drops the card when the link is deleted again", async () => {
    const { textarea } = renderForm();

    fireEvent.change(textarea, {
      target: { value: "look at https://example.com/article" },
    });
    await waitFor(() => {
      expect(screen.getByText("An article worth reading")).toBeTruthy();
    });

    fireEvent.change(textarea, { target: { value: "never mind" } });

    await waitFor(() => {
      expect(screen.queryByText("An article worth reading")).toBeNull();
    });
  });

  it("says nothing when the page has no card to give", async () => {
    mockGetLinkPreview.mockResolvedValue(null);
    const { onOptimisticSubmit, textarea } = renderForm();

    fireEvent.change(textarea, {
      target: { value: "https://example.com/nothing-here" },
    });
    await waitFor(() => {
      expect(mockGetLinkPreview).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    const formData = submitted(onOptimisticSubmit);
    // The link still goes over: the server may resolve what the composer could
    // not, and it is the server's card that gets stored either way.
    expect(formData.get("previewUrl")).toBe(
      "https://example.com/nothing-here",
    );
    expect(formData.get("previewData")).toBeNull();
  });

  it("posts without a link at all", () => {
    const { onOptimisticSubmit, textarea } = renderForm();

    fireEvent.change(textarea, { target: { value: "no links today" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(submitted(onOptimisticSubmit).get("previewUrl")).toBe("");
    expect(mockGetLinkPreview).not.toHaveBeenCalled();
  });
});
