"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, PlusIcon } from "lucide-react";
import { createGroup } from "@/app/actions/groups";

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
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
    await createGroup(formData);

    setLoading(false);
    setOpen(false);
    clearPreview();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) clearPreview(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusIcon />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>
            Give your group a name, description, and optional cover image.
          </DialogDescription>
        </DialogHeader>
        <form id="create-group-form" onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Marketing Team"
              required
              minLength={2}
              maxLength={100}
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              placeholder="What is this group about?"
              rows={3}
              maxLength={500}
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="cover" className="text-sm font-medium">
              Cover image
            </label>
            {preview ? (
              <div className="relative overflow-hidden rounded-lg border">
                <img
                  src={preview}
                  alt="Cover preview"
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
                className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <ImageIcon className="size-6" />
                Click to upload a cover image
              </button>
            )}
            <input
              ref={fileRef}
              id="cover"
              name="cover"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
              className="hidden"
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="create-group-form" disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
