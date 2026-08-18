import Link from "next/link";

const MENTION_REGEX = /@(\w{1,20})\b/g;

export function MentionContent({ content }: { content: string }) {
  const parts: (string | { handle: string; key: number })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const regex = new RegExp(MENTION_REGEX);
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push({ handle: match[1], key: key++ });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  if (parts.length === 0) return <>{content}</>;

  return (
    <>
      {parts.map((part) =>
        typeof part === "string" ? (
          part
        ) : (
          <Link
            key={part.key}
            href={`/profile/${part.handle}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{part.handle}
          </Link>
        ),
      )}
    </>
  );
}
