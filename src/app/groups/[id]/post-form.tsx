"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import { ImageIcon } from "lucide-react";

export function PostForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const clearPreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("groupId", groupId);
    await createPost(formData);
    formRef.current?.reset();
    clearPreview();
    setLoading(false);
    router.refresh();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mb-6">
      <input type="hidden" name="groupId" value={groupId} />
      <Textarea
        name="content"
        placeholder="Write a post..."
        rows={3}
        required
        disabled={loading}
        className="mb-3"
      />
      {preview ? (
        <div className="relative mb-3 overflow-hidden rounded-lg border">
          <img
            src={preview}
            alt="Preview"
            className="aspect-video w-full object-cover"
          />
          <button
            type="button"
            onClick={clearPreview}
            className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <ImageIcon className="size-3.5" />
          Add image
        </button>
      )}
      <input
        ref={fileRef}
        name="image"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={loading}
        className="hidden"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}
