"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PollResults } from "@/lib/poll";

/**
 * A poll as it appears in a feed. Purely presentational: the tally and the
 * viewer's own choice arrive as props, and voting is the caller's business —
 * which is what lets a virtualized list keep poll state above the row that
 * scrolls in and out.
 *
 * Results are always visible, including before you answer. The point of the
 * post is the split, so hiding it until you commit would bury the thing
 * people came to see.
 */
export function PollBlock({
  poll,
  onVote,
  canVote = true,
  className,
}: {
  poll: PollResults;
  onVote?: (optionId: string) => void;
  canVote?: boolean;
  className?: string;
}) {
  const total = poll.totalVotes;

  return (
    <div className={cn("space-y-2", className)}>
      {poll.options.map((option) => {
        const isChoice = poll.votedOptionId === option.id;
        const interactive = canVote && !!onVote;

        return (
          <button
            key={option.id}
            type="button"
            // Already-chosen is not a disabled state: you can still move your
            // vote to another option, you just cannot re-cast the same one.
            disabled={!interactive || isChoice}
            aria-pressed={isChoice}
            onClick={(event) => {
              // The whole post is a link to its detail page; answering a poll
              // is not a request to navigate there.
              event.stopPropagation();
              onVote?.(option.id);
            }}
            className={cn(
              "relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition",
              isChoice ? "border-primary" : "border-border",
              interactive && !isChoice && "hover:border-primary/50",
              !interactive && "cursor-default",
            )}
          >
            {/* The bar sits behind the label rather than beside it, so a long
                choice keeps the full width to wrap into. */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-0 transition-[width] duration-300",
                isChoice ? "bg-primary/20" : "bg-muted",
              )}
              style={{ width: `${option.percentage}%` }}
            />
            <span className="relative flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                {isChoice && (
                  <CheckIcon className="size-3.5 shrink-0 text-primary" />
                )}
                <span className="truncate">{option.text}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">
                  {option.percentage}%
                </span>{" "}
                · {option.votes} {option.votes === 1 ? "vote" : "votes"}
              </span>
            </span>
          </button>
        );
      })}

      <p className="text-xs text-muted-foreground">
        {total === 0
          ? "No votes yet"
          : `${total} ${total === 1 ? "vote" : "votes"}`}
        {poll.votedOptionId && " · you voted"}
      </p>
    </div>
  );
}
