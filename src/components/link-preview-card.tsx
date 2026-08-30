"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hostOf, type LinkPreview } from "@/lib/links";

/**
 * The Open Graph card for a link, as shown under a post and inside the
 * composer. `onDismiss` turns on the remove button — composer only; a published
 * card is part of the post.
 */
export function LinkPreviewCard({
  preview,
  onDismiss,
  className,
}: {
  preview: LinkPreview;
  onDismiss?: () => void;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        // Post cards are click-through to the post page; the link is its own
        // destination.
        onClick={(e) => e.stopPropagation()}
        className="block overflow-hidden rounded-xl border transition hover:bg-muted/40"
      >
        {preview.image && !imageFailed && (
          // Not next/image: these come from any host on the internet, so they
          // cannot go through the optimizer's allowlist.
          <img
            src={preview.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="aspect-[1.91/1] w-full bg-muted object-cover"
          />
        )}
        <div className="p-3">
          <p className="truncate text-xs text-muted-foreground">
            {preview.siteName || hostOf(preview.url)}
          </p>
          {preview.title && (
            <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug">
              {preview.title}
            </p>
          )}
          {preview.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {preview.description}
            </p>
          )}
        </div>
      </a>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Remove link preview"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Holds the card's place while the composer is still fetching it. */
export function LinkPreviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3", className)}>
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
