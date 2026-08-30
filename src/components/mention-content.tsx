import Link from "next/link";
import { URL_REGEX_SOURCE, displayUrl, normalizeUrl } from "@/lib/links";

const MENTION_REGEX = /@(\w{1,20})\b/g;

const COMBINED_REGEX = new RegExp(
  `(${MENTION_REGEX.source})|(${URL_REGEX_SOURCE})`,
  "gi",
);

type Part =
  | string
  | { type: "mention"; handle: string; key: number }
  | { type: "link"; url: string; key: number };

export function MentionContent({ content }: { content: string }) {
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const regex = new RegExp(COMBINED_REGEX);
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push({ type: "mention", handle: match[2], key: key++ });
    } else {
      parts.push({ type: "link", url: match[0], key: key++ });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  if (parts.length === 0) return <>{content}</>;

  return (
    <>
      {parts.map((part) => {
        if (typeof part === "string") return part;
        if (part.type === "mention") {
          return (
            <Link
              key={part.key}
              href={`/profile/${part.handle}`}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              @{part.handle}
            </Link>
          );
        }
        return (
          <a
            key={part.key}
            href={normalizeUrl(part.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {displayUrl(part.url)}
          </a>
        );
      })}
    </>
  );
}
