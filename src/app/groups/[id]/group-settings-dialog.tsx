"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, SettingsIcon } from "lucide-react";
import { updateGroupSettings } from "@/app/actions/groups";
import { VaulDrawer, useIsMobile } from "@/components/ui/vaul-drawer";

interface GroupSettingsDialogProps {
  groupId: string;
  name: string;
  description: string;
  logo: string | null;
  isPrivate: boolean;
}

function SettingsForm({
  groupId,
  name: initialName,
  description: initialDesc,
  logo: initialLogo,
  isPrivate: initialIsPrivate,
  onClose,
}: GroupSettingsDialogProps & { onClose: () => void }) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc || "");
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [preview, setPreview] = useState<string | null>(initialLogo);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const clearPreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearPreview;
  }, [clearPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPreview(url);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.set("groupId", groupId);
    formData.set("name", name);
    formData.set("description", description);
    formData.set("isPrivate", String(isPrivate));

    if (fileRef.current?.files?.[0] && fileRef.current.files[0].size > 0) {
      formData.set("cover", fileRef.current.files[0]);
    }

    await updateGroupSettings(formData);
    setSaving(false);
    clearPreview();
    onClose();
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={saving} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Cover image</label>
        {preview ? (
          <div className="relative overflow-hidden rounded-lg border">
            <img src={preview} alt="Preview" className="aspect-video w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                clearPreview();
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition hover:border-indigo-300 hover:text-indigo-600"
          >
            <ImageIcon className="size-6" />
            Click to upload a cover image
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} disabled={saving} className="hidden" />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Private group</p>
          <p className="text-xs text-muted-foreground">Only members can see this group</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPrivate(!isPrivate)}
          className={`relative h-6 w-11 rounded-full transition ${isPrivate ? "bg-indigo-600" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              isPrivate ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}

export function GroupSettingsDialog(props: GroupSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleClose = () => setOpen(false);

  const trigger = (
    <Button variant="outline" size="sm" className="gap-1.5">
      <SettingsIcon className="size-4" />
      Settings
    </Button>
  );

  if (isMobile) {
    return (
      <VaulDrawer open={open} onOpenChange={setOpen} trigger={trigger}>
        <h2 className="text-lg font-semibold">Group settings</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Update your group name, description, cover, and visibility.
        </p>
        <SettingsForm {...props} onClose={handleClose} />
      </VaulDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Group settings</DialogTitle>
          <DialogDescription>
            Update your group name, description, cover, and visibility.
          </DialogDescription>
        </DialogHeader>
        <SettingsForm {...props} onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
}
