import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PollBlock } from "@/app/groups/[id]/poll-block";
import { buildPollResults } from "@/lib/poll";

const poll = (counts: Record<string, number>, voted: string | null = null) =>
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

/** A choice's whole row — the label, its percentage and its count. */
const choice = (text: string) =>
  screen.getByRole("button", { name: new RegExp(text) });

describe("PollBlock", () => {
  it("shows each choice's count and percentage", () => {
    render(<PollBlock poll={poll({ a: 1, b: 3 })} onVote={vi.fn()} />);

    expect(choice("Tabs").textContent).toContain("25%");
    expect(choice("Tabs").textContent).toContain("1 vote");
    expect(choice("Spaces").textContent).toContain("75%");
    expect(choice("Spaces").textContent).toContain("3 votes");
    expect(screen.getByText(/^4 votes/)).toBeTruthy();
  });

  it("says so plainly when nobody has voted", () => {
    render(<PollBlock poll={poll({})} onVote={vi.fn()} />);

    expect(screen.getByText("No votes yet")).toBeTruthy();
    expect(choice("Tabs").textContent).toContain("0%");
  });

  it("reports the choice back to the caller", () => {
    const onVote = vi.fn();
    render(<PollBlock poll={poll({ a: 1 })} onVote={onVote} />);

    fireEvent.click(choice("Spaces"));

    expect(onVote).toHaveBeenCalledWith("b");
  });

  it("marks the viewer's own choice and won't re-cast it", () => {
    const onVote = vi.fn();
    render(<PollBlock poll={poll({ a: 1 }, "a")} onVote={onVote} />);

    expect(choice("Tabs").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/you voted/)).toBeTruthy();

    fireEvent.click(choice("Tabs"));
    expect(onVote).not.toHaveBeenCalled();

    // Moving the vote elsewhere is still allowed.
    fireEvent.click(choice("Spaces"));
    expect(onVote).toHaveBeenCalledWith("b");
  });

  it("shows results but takes no vote from someone who cannot vote", () => {
    const onVote = vi.fn();
    render(<PollBlock poll={poll({ a: 2 })} onVote={onVote} canVote={false} />);

    expect(choice("Tabs").textContent).toContain("100%");
    fireEvent.click(choice("Tabs"));
    expect(onVote).not.toHaveBeenCalled();
  });

  it("does not let a vote bubble into the post's own click target", () => {
    const onPostClick = vi.fn();
    render(
      <div onClick={onPostClick}>
        <PollBlock poll={poll({})} onVote={vi.fn()} />
      </div>,
    );

    fireEvent.click(choice("Tabs"));

    // Answering a poll is not a request to open the post page.
    expect(onPostClick).not.toHaveBeenCalled();
  });
});
