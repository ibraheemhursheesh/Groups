"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon } from "lucide-react";

const MAX_IMAGES = 10;

type ImageItem = {
  url: string;
  isExisting: boolean;
};

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  groupId: string;
  initialContent: string;
  initialImages: string[];
  onSave: (postId: string, groupId: string, content: string, existingUrls: string[], newFiles: File[]) => Promise<void>;
}

export function EditPostDialog({
  open,
  onOpenChange,
  postId,
  groupId,
  initialContent,
  initialImages,
  onSave,
}: EditPostDialogProps) {
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState<ImageItem[]>(() =>
    initialImages.map((url) => ({ url, isExisting: true })),
  );
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const newFilesRef = useRef<Map<string, File>>(new Map());

  const cleanupUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return cleanupUrls;
  }, [cleanupUrls]);

  useEffect(() => {
    if (open) {
      setContent(initialContent);
      setImages(initialImages.map((url) => ({ url, isExisting: true })));
      newFilesRef.current = new Map();
    }
  }, [open, initialContent, initialImages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > MAX_IMAGES) return;
    const newItems: ImageItem[] = files.map((f) => {
      const url = URL.createObjectURL(f);
      objectUrlsRef.current.push(url);
      newFilesRef.current.set(url, f);
      return { url, isExisting: false };
    });
    setImages((prev) => [...prev, ...newItems]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (index: number) => {
    const item = images[index];
    if (!item.isExisting) {
      URL.revokeObjectURL(item.url);
      objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== item.url);
      newFilesRef.current.delete(item.url);
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);

    const existingUrls = images.filter((i) => i.isExisting).map((i) => i.url);

    await onSave(postId, groupId, content.trim(), existingUrls, Array.from(newFilesRef.current.values()));
    setSaving(false);
    cleanupUrls();
    onOpenChange(false);
  };

  const handleClose = () => {
    cleanupUrls();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>
            Update your post text or manage images.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            disabled={saving}
          />

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {images.map((img, i) => (
                <div key={i} className="relative overflow-hidden rounded-lg border">
                  <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white hover:bg-black/70"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <ImageIcon className="size-3.5" />
              Add images ({images.length}/{MAX_IMAGES})
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={saving}
            className="hidden"
          />
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
