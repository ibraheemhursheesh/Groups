"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MAX_POLL_OPTIONS, MAX_POLL_OPTION_LENGTH } from "@/lib/poll";

/**
 * The choices half of a poll composer. The question is the post's own
 * textarea, so this only owns the list — and it keeps blank rows in state
 * rather than filtering as you type, so a half-typed choice doesn't vanish
 * from under the cursor. The blanks are dropped at submit.
 */
export function PollEditor({
  options,
  onChange,
  onRemove,
}: {
  options: string[];
  onChange: (options: string[]) => void;
  onRemove: () => void;
}) {
  const setOption = (index: number, value: string) =>
    onChange(options.map((option, i) => (i === index ? value : option)));

  const addOption = () => {
    if (options.length >= MAX_POLL_OPTIONS) return;
    onChange([...options, ""]);
  };

  const removeOption = (index: number) => {
    // Below two there is no poll left, so the last removals end poll mode
    // rather than leaving a question nobody can answer.
    if (options.length <= 2) {
      onRemove();
      return;
    }
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="mb-3 rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Poll choices
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground transition hover:text-foreground"
        >
          Remove poll
        </button>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(e) => setOption(index, e.target.value)}
              placeholder={`Choice ${index + 1}`}
              maxLength={MAX_POLL_OPTION_LENGTH}
              aria-label={`Poll choice ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeOption(index)}
              aria-label={`Remove choice ${index + 1}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {options.length < MAX_POLL_OPTIONS && (
        <button
          type="button"
          onClick={addOption}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-primary"
        >
          <PlusIcon className="size-3.5" />
          Add choice ({options.length}/{MAX_POLL_OPTIONS})
        </button>
      )}
    </div>
  );
}
