"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { useRef, useState, useEffect, useCallback } from "react";
import { ImageIcon, LoaderCircleIcon } from "lucide-react";
import { searchGroupMembers } from "@/app/actions/groups";
import imageCompression from "browser-image-compression";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  // maxWidthOrHeight: 1280,
  // initialQuality: 0.7,
  useWebWorker: true,
};

const MAX_IMAGES = 10;

type MentionSuggestion = {
  userId: string;
  name: string;
  handle: string;
  image: string | null;
};

interface PostFormProps {
  groupId: string;
  isAdmin: boolean;
  onOptimisticSubmit: (formData: FormData) => void;
}

function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const div = document.createElement("div");
  const style = window.getComputedStyle(textarea);
  const properties = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "textTransform",
    "wordSpacing",
    "textIndent",
    "boxSizing",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "borderBottomWidth",
    "lineHeight",
    "whiteSpace",
    "wordWrap",
    "overflowWrap",
  ] as const;

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.width = `${textarea.clientWidth}px`;

  for (const prop of properties) {
    div.style[prop as any] = style.getPropertyValue(
      prop.replace(/([A-Z])/g, "-$1").toLowerCase(),
    );
  }

  div.textContent = textarea.value.substring(0, position);
  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position) || ".";
  div.appendChild(span);
  document.body.appendChild(div);

  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();

  const top = spanRect.top - divRect.top - textarea.scrollTop;
  const left = spanRect.left - divRect.left - textarea.scrollLeft;
  const height = spanRect.height;

  document.body.removeChild(div);
  return { top, left, height };
}

function getMentionQuery(
  textarea: HTMLTextAreaElement,
): { query: string; atIndex: number } | null {
  const { value, selectionStart } = textarea;
  if (selectionStart === null) return null;

  const textBeforeCursor = value.slice(0, selectionStart);
  const match = textBeforeCursor.match(/@(\w{2,})$/);
  if (!match) return null;

  return { query: match[1], atIndex: textBeforeCursor.lastIndexOf("@") };
}

export function PostForm({ groupId, isAdmin, onOptimisticSubmit }: PostFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const compressedFilesRef = useRef<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [content, setContent] = useState("");
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [anchorPos, setAnchorPos] = useState({ top: 0, left: 0, height: 0 });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const clearPreviews = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    compressedFilesRef.current = [];
    setPreviews([]);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newCount = previews.length + files.length;
    if (newCount > MAX_IMAGES) return;

    const newUrls = files.map((f) => URL.createObjectURL(f));
    objectUrlsRef.current = [...objectUrlsRef.current, ...newUrls];
    setPreviews((prev) => [...prev, ...newUrls]);

    setCompressing(true);
    const compressed = await Promise.all(
      files.map((f) => imageCompression(f, COMPRESSION_OPTIONS)),
    );
    compressedFilesRef.current = [...compressedFilesRef.current, ...compressed];
    setCompressing(false);
  };

  const removePreview = (index: number) => {
    URL.revokeObjectURL(objectUrlsRef.current[index]);
    objectUrlsRef.current = objectUrlsRef.current.filter((_, i) => i !== index);
    compressedFilesRef.current = compressedFilesRef.current.filter((_, i) => i !== index);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    if (fileRef.current) fileRef.current.value = "";
  };

  const insertMention = (handle: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { value, selectionStart } = textarea;
    const textBeforeCursor = value.slice(0, selectionStart);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;

    const before = value.slice(0, atIndex);
    const after = value.slice(selectionStart);
    const newValue = `${before}@${handle} ${after}`;

    setContent(newValue);
    setShowSuggestions(false);
    setSuggestions([]);

    requestAnimationFrame(() => {
      const cursorPos = atIndex + handle.length + 2;
      textarea.selectionStart = cursorPos;
      textarea.selectionEnd = cursorPos;
      textarea.focus();
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setContent(newValue);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const mention = getMentionQuery(e.target);
    if (mention) {
      const coords = getCaretCoordinates(e.target, mention.atIndex);
      setAnchorPos(coords);

      searchTimeoutRef.current = setTimeout(async () => {
        const results = await searchGroupMembers(groupId, mention.query);
        if (results.length > 0) {
          setSuggestions(results);
          setShowSuggestions(true);
          setSelectedIndex(0);
        } else {
          setShowSuggestions(false);
        }
      }, 150);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(suggestions[selectedIndex].handle);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = () => {
    if (!content.trim() && compressedFilesRef.current.length === 0) return;
    const formData = new FormData();
    formData.set("groupId", groupId);
    formData.set("content", content);
    for (const file of compressedFilesRef.current) {
      formData.append("images", file);
    }
    onOptimisticSubmit(formData);
    formRef.current?.reset();
    setContent("");
    clearPreviews();
  };

  return (
    <form ref={formRef} className="mb-6">
      <input type="hidden" name="groupId" value={groupId} />

      <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
        <div className="relative mb-3">
          <Textarea
            ref={textareaRef}
            name="content"
            placeholder="Write a post... Use @ to mention someone"
            rows={3}
            value={content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
          <PopoverAnchor
            className="pointer-events-none"
            style={{
              position: "absolute",
              top: anchorPos.top,
              left: anchorPos.left,
              height: anchorPos.height,
              width: 1,
            }}
          />
        </div>
        <PopoverContent
          side="bottom"
          align="start"
          className="w-64 p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {suggestions.map((member, index) => (
            <button
              key={member.userId}
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition ${
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(member.handle);
              }}
            >
              {member.image ? (
                <img
                  src={member.image}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{member.handle}
                </p>
              </div>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {previews.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-1">
          {previews.map((src, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg border">
              <img
                src={src}
                alt=""
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePreview(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white hover:bg-black/70"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {previews.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <ImageIcon className="size-3.5" />
            Add images ({previews.length}/{MAX_IMAGES})
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={compressing}
          className="px-10 py-7.5 text-base"
        >
          {compressing && <LoaderCircleIcon className="size-4 animate-spin" />}
          Post
        </Button>
      </div>
    </form>
  );
}
