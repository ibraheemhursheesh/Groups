"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, LoaderCircleIcon } from "lucide-react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  useWebWorker: true,
};

const MAX_IMAGES = 10;

interface ProfilePostFormProps {
  onOptimisticSubmit: (formData: FormData) => void;
}

export function ProfilePostForm({ onOptimisticSubmit }: ProfilePostFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const compressedFilesRef = useRef<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [content, setContent] = useState("");

  const clearPreviews = useCallback(() => {
    // The urls are handed to the optimistic post, which owns them from here on
    // — revoking now would blank the image the user just posted.
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
    if (previews.length + files.length > MAX_IMAGES) return;

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
    compressedFilesRef.current = compressedFilesRef.current.filter(
      (_, i) => i !== index,
    );
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!content.trim() && compressedFilesRef.current.length === 0) return;

    const formData = new FormData();
    formData.set("content", content);
    for (const file of compressedFilesRef.current) {
      formData.append("images", file);
    }
    // Carried alongside the files so the optimistic post can show the pictures
    // before the upload has produced any public urls.
    formData.set("previewUrls", JSON.stringify(previews));

    onOptimisticSubmit(formData);
    formRef.current?.reset();
    setContent("");
    clearPreviews();
  };

  return (
    <form ref={formRef}>
      <Textarea
        name="content"
        placeholder="Share something on your profile..."
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="mb-3"
      />

      {previews.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-1">
          {previews.map((src, i) => (
            <div key={src} className="relative overflow-hidden rounded-lg border">
              <img src={src} alt="" className="aspect-square w-full object-cover" />
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
          disabled={compressing || (!content.trim() && previews.length === 0)}
          className="ml-auto px-8"
        >
          {compressing && <LoaderCircleIcon className="size-4 animate-spin" />}
          Post
        </Button>
      </div>
    </form>
  );
}
