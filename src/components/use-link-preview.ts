"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLinkPreview } from "@/app/actions/link-preview";
import { extractFirstUrl, type LinkPreview } from "@/lib/links";

const DEBOUNCE_MS = 400;

/**
 * Watches composer text and keeps the card for its first link in step with it.
 *
 * What the form sends to the server is `previewUrl` — the link, not the card.
 * The server fetches the card itself (see `resolvePostLinkPreview`), so nothing
 * a client makes up can end up on a published post; an empty value is how the
 * form says the author dismissed it.
 */
export function useLinkPreview(content: string, initial?: LinkPreview | null) {
  const url = extractFirstUrl(content);
  const [preview, setPreview] = useState<LinkPreview | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);

  // Bumped per lookup so a slow answer for an old url cannot overwrite a newer
  // one, and `null` once nothing is loaded.
  const requestRef = useRef(0);
  const loadedUrlRef = useRef<string | null>(initial?.url ?? null);

  const dismissed = url !== null && url === dismissedUrl;
  // What the form submits: the link to fetch a card for, empty when there
  // should be none.
  const previewUrl = dismissed || !url ? "" : url;

  useEffect(() => {
    if (!url || url === dismissedUrl) {
      requestRef.current += 1;
      loadedUrlRef.current = null;
      setPreview(null);
      setLoading(false);
      return;
    }

    if (loadedUrlRef.current === url) return;

    const id = (requestRef.current += 1);
    setLoading(true);

    // Typing a url a character at a time would otherwise fetch every prefix.
    const timer = setTimeout(() => {
      getLinkPreview(url)
        .then((result) => {
          if (id !== requestRef.current) return;
          loadedUrlRef.current = url;
          setPreview(result);
        })
        .catch(() => {
          if (id === requestRef.current) setPreview(null);
        })
        .finally(() => {
          if (id === requestRef.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [url, dismissedUrl]);

  const dismiss = useCallback(() => {
    if (url) setDismissedUrl(url);
  }, [url]);

  const reset = useCallback(() => {
    requestRef.current += 1;
    loadedUrlRef.current = null;
    setPreview(null);
    setLoading(false);
    setDismissedUrl(null);
  }, []);

  /**
   * Adds the two fields a composer submits: the link the server should fetch a
   * card for (empty when dismissed or absent), and the card already in hand, so
   * the optimistic post can show it before the server answers.
   */
  const appendTo = useCallback(
    (formData: FormData) => {
      formData.set("previewUrl", previewUrl);
      if (!dismissed && preview) {
        formData.set("previewData", JSON.stringify(preview));
      }
    },
    [dismissed, preview, previewUrl],
  );

  return {
    preview: dismissed ? null : preview,
    loading: loading && !dismissed,
    dismissed,
    previewUrl,
    dismiss,
    reset,
    appendTo,
  };
}
