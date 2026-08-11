"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRef, useState, useEffect, useCallback } from "react";
import { ImageIcon } from "lucide-react";

const MAX_IMAGES = 10;

interface PostFormProps {
  groupId: string;
  isAdmin: boolean;
  onOptimisticSubmit: (formData: FormData) => void;
}

export function PostForm({ groupId, isAdmin, onOptimisticSubmit }: PostFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const clearPreviews = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setPreviews([]);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newCount = previews.length + files.length;
    if (newCount > MAX_IMAGES) return;

    const newUrls = files.map((f) => URL.createObjectURL(f));
    objectUrlsRef.current = [...objectUrlsRef.current, ...newUrls];
    setPreviews((prev) => [...prev, ...newUrls]);
  };

  const removePreview = (index: number) => {
    URL.revokeObjectURL(objectUrlsRef.current[index]);
    objectUrlsRef.current = objectUrlsRef.current.filter((_, i) => i !== index);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("groupId", groupId);
    onOptimisticSubmit(formData);
    formRef.current?.reset();
    clearPreviews();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mb-6">
      <input type="hidden" name="groupId" value={groupId} />
      <Textarea
        name="content"
        placeholder="Write a post..."
        rows={3}
        className="mb-3"
      />

      {previews.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-1">
          {previews.map((src, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg border">
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

      {previews.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          <ImageIcon className="size-3.5" />
          Add images ({previews.length}/{MAX_IMAGES})
        </button>
      )}

      <input
        ref={fileRef}
        name="images"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <Button type="submit">Post</Button>
    </form>
  );
}
