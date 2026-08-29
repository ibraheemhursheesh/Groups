import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileClient } from "@/app/profile/[handle]/profile-client";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockUpdateProfile = vi.fn();
vi.mock("@/app/actions/profile", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
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

// Typed from the component rather than inferred, so `image: null` — the case
// the no-photo test covers — is representable in the overrides.
const baseProfile: ComponentProps<typeof ProfileClient>["profile"] = {
  name: "Ibrahim Harchiche",
  handle: "ibrahim",
  image: "https://storage.example.com/profiles/photo.jpg",
  createdAt: new Date("2024-06-15"),
};

function renderProfile(
  overrides?: Partial<typeof baseProfile>,
  isOwner = true,
) {
  return render(
    <ProfileClient
      profile={{ ...baseProfile, ...overrides }}
      isOwner={isOwner}
    />,
  );
}

function createFile(name = "avatar.png", size = 1024, type = "image/png") {
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateProfile.mockResolvedValue({ ok: true });
});

describe("ProfileClient – image display", () => {
  it("shows the profile image when one exists", () => {
    renderProfile();
    const img = screen.getByAltText("Ibrahim Harchiche") as HTMLImageElement;
    expect(img.src).toBe(baseProfile.image);
  });

  it("shows the initial letter when no image exists", () => {
    renderProfile({ image: null });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("I")).toBeTruthy();
  });
});

describe("ProfileClient – owner vs visitor", () => {
  it("shows Edit profile button for the owner", () => {
    renderProfile({}, true);
    expect(screen.getByText("Edit profile")).toBeTruthy();
  });

  it("hides Edit profile button for visitors", () => {
    renderProfile({}, false);
    expect(screen.queryByText("Edit profile")).toBeNull();
  });

  it("hides the camera overlay for visitors", () => {
    renderProfile({}, false);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ProfileClient – file selection", () => {
  it("shows a blob preview and enters editing mode when a file is selected", async () => {
    renderProfile();
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = createFile();
    fireEvent.change(fileInput, { target: { files: [file] } });

    const img = screen.getByAltText("Ibrahim Harchiche") as HTMLImageElement;
    expect(img.src).toMatch(/^blob:/);
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("does nothing when file selection is cancelled (no file)", () => {
    renderProfile();
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [] } });

    const img = screen.getByAltText("Ibrahim Harchiche") as HTMLImageElement;
    expect(img.src).toBe(baseProfile.image);
    expect(screen.queryByText("Save")).toBeNull();
  });
});

describe("ProfileClient – save flow", () => {
  it("calls updateProfile with name and photo in FormData", async () => {
    renderProfile();
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = createFile();

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    });

    const fd: FormData = mockUpdateProfile.mock.calls[0][0];
    expect(fd.get("name")).toBe("Ibrahim Harchiche");
    expect(fd.get("photo")).toBe(file);
  });

  it("calls updateProfile with only name when no photo is selected", async () => {
    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    });

    const fd: FormData = mockUpdateProfile.mock.calls[0][0];
    expect(fd.get("name")).toBe("Ibrahim Harchiche");
    expect(fd.get("photo")).toBeNull();
  });

  it("calls router.refresh after a successful save", async () => {
    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("exits editing mode after a successful save", async () => {
    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Edit profile")).toBeTruthy();
    });
  });

  it("shows 'Saving...' and disables buttons while submitting", async () => {
    let resolve: (v: { ok: true }) => void;
    mockUpdateProfile.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));
    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Saving...")).toBeTruthy();
    expect(
      (screen.getByText("Saving...") as HTMLButtonElement).disabled,
    ).toBe(true);

    resolve!({ ok: true });
    await waitFor(() => {
      expect(screen.queryByText("Saving...")).toBeNull();
    });
  });

  it("disables Save when name is empty", () => {
    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));

    const nameInput = screen.getByDisplayValue("Ibrahim Harchiche");
    fireEvent.change(nameInput, { target: { value: "" } });

    expect((screen.getByText("Save") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe("ProfileClient – error handling", () => {
  it("shows server error and stays in editing mode", async () => {
    mockUpdateProfile.mockResolvedValue({
      ok: false,
      error: "Name cannot be empty.",
    });

    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Name cannot be empty.")).toBeTruthy();
    });
    expect(screen.getByText("Save")).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("shows generic error when the action throws", async () => {
    mockUpdateProfile.mockRejectedValue(new Error("network error"));

    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Something went wrong.")).toBeTruthy();
    });
  });

  it("keeps the blob preview visible after a server error", async () => {
    mockUpdateProfile.mockResolvedValue({
      ok: false,
      error: "Failed to upload photo.",
    });

    renderProfile();
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createFile()] } });

    const img = screen.getByAltText("Ibrahim Harchiche") as HTMLImageElement;
    const blobSrc = img.src;
    expect(blobSrc).toMatch(/^blob:/);

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Failed to upload photo.")).toBeTruthy();
    });

    const imgAfter = screen.getByAltText(
      "Ibrahim Harchiche",
    ) as HTMLImageElement;
    expect(imgAfter.src).toBe(blobSrc);
  });
});

describe("ProfileClient – cancel flow", () => {
  it("reverts name and clears preview on cancel", () => {
    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));

    const nameInput = screen.getByDisplayValue(
      "Ibrahim Harchiche",
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Name" } });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createFile()] } });

    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByText("Ibrahim Harchiche")).toBeTruthy();
    const img = screen.getByAltText("Ibrahim Harchiche") as HTMLImageElement;
    expect(img.src).toBe(baseProfile.image);
    expect(screen.getByText("Edit profile")).toBeTruthy();
  });

  it("clears error message on cancel", async () => {
    mockUpdateProfile.mockResolvedValue({
      ok: false,
      error: "Some error",
    });

    renderProfile();
    fireEvent.click(screen.getByText("Edit profile"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Some error")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Some error")).toBeNull();
  });
});

describe("ProfileClient – blob preview cleared on prop change", () => {
  it("clears blob preview when profile.image prop changes (server refresh)", () => {
    const { rerender } = render(
      <ProfileClient profile={baseProfile} isOwner={true} />,
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createFile()] } });

    const img = screen.getByAltText("Ibrahim Harchiche") as HTMLImageElement;
    expect(img.src).toMatch(/^blob:/);

    rerender(
      <ProfileClient
        profile={{
          ...baseProfile,
          image: "https://storage.example.com/profiles/new-photo.jpg",
        }}
        isOwner={true}
      />,
    );

    const imgAfter = screen.getByAltText(
      "Ibrahim Harchiche",
    ) as HTMLImageElement;
    expect(imgAfter.src).toBe(
      "https://storage.example.com/profiles/new-photo.jpg",
    );
  });

  it("keeps blob preview when profile.image prop stays the same", () => {
    const { rerender } = render(
      <ProfileClient profile={baseProfile} isOwner={true} />,
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createFile()] } });

    const img = screen.getByAltText("Ibrahim Harchiche") as HTMLImageElement;
    expect(img.src).toMatch(/^blob:/);
    const blobSrc = img.src;

    rerender(
      <ProfileClient profile={baseProfile} isOwner={true} />,
    );

    const imgAfter = screen.getByAltText(
      "Ibrahim Harchiche",
    ) as HTMLImageElement;
    expect(imgAfter.src).toBe(blobSrc);
  });
});
