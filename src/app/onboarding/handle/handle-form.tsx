"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkHandleAvailability, setHandle } from "@/app/actions/handle";
import { HANDLE_MAX_LENGTH, validateHandle } from "@/lib/handle";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "error"; message: string };

/** Keeps what the user types inside the character set a handle can contain. */
function sanitizeTyping(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, HANDLE_MAX_LENGTH);
}

export function HandleForm({ initialHandle }: { initialHandle: string }) {
  const router = useRouter();
  const [handle, setHandleValue] = useState(initialHandle);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Guards against a slow early response overwriting a newer one.
  const requestSeq = useRef(0);

  useEffect(() => {
    const local = validateHandle(handle);
    if (!local.ok) {
      setStatus(
        handle.length === 0
          ? { kind: "idle" }
          : { kind: "error", message: local.error },
      );
      return;
    }

    setStatus({ kind: "checking" });
    const seq = ++requestSeq.current;

    const timer = setTimeout(async () => {
      try {
        const result = await checkHandleAvailability(local.handle);
        if (seq !== requestSeq.current) return; // a newer keystroke won
        setStatus(
          result.available
            ? { kind: "available" }
            : { kind: "error", message: result.error ?? "Handle unavailable." },
        );
      } catch {
        if (seq !== requestSeq.current) return;
        setStatus({ kind: "error", message: "Could not check that handle." });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [handle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const local = validateHandle(handle);
    if (!local.ok) {
      setStatus({ kind: "error", message: local.error });
      return;
    }

    setSubmitting(true);
    try {
      const result = await setHandle(local.handle);
      if (!result.ok) {
        setSubmitError(result.error);
        setStatus({ kind: "error", message: result.error });
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = status.kind === "available" && !submitting;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-3 transition focus-within:border-ring focus-within:ring-4 focus-within:ring-primary/20">
          <span className="text-sm font-medium text-muted-foreground">@</span>
          <input
            autoFocus
            value={handle}
            onChange={(e) => setHandleValue(sanitizeTyping(e.target.value))}
            placeholder="yourhandle"
            aria-label="Handle"
            aria-invalid={status.kind === "error"}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {status.kind === "checking" && (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
          {status.kind === "available" && (
            <Check className="size-4 shrink-0 text-green-600" />
          )}
          {status.kind === "error" && (
            <X className="size-4 shrink-0 text-destructive" />
          )}
        </div>

        <p className="mt-2 min-h-[1rem] px-1 text-xs">
          {status.kind === "error" && (
            <span className="text-destructive">{status.message}</span>
          )}
          {status.kind === "available" && (
            <span className="text-green-600">@{handle} is available.</span>
          )}
          {(status.kind === "idle" || status.kind === "checking") && (
            <span className="text-muted-foreground">
              Letters, numbers, and underscores. 3–{HANDLE_MAX_LENGTH}{" "}
              characters.
            </span>
          )}
        </p>
      </div>

      {submitError && <p className="text-xs text-destructive">{submitError}</p>}

      <Button type="submit" disabled={!canSubmit}>
        {submitting ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
