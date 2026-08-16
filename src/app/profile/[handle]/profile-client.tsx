"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/app/actions/profile";
import Link from "next/link";

type Profile = {
  name: string;
  handle: string;
  image: string | null;
  createdAt: Date;
};

function formatJoinDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function ProfileClient({
  profile,
  isOwner,
}: {
  profile: Profile;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const displayImage = previewUrl ?? profile.image;

  // Once the server refresh delivers the new image URL, the blob preview
  // is no longer needed. This bridges the gap without a flash.
  const prevServerImage = useRef(profile.image);
  if (prevServerImage.current !== profile.image) {
    prevServerImage.current = profile.image;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedFileRef.current = file;
    setPreviewUrl(URL.createObjectURL(file));
    if (!editing) setEditing(true);
  };

  const handleSave = async () => {
    setError(null);
    setSubmitting(true);

    const fd = new FormData();
    fd.set("name", name);
    if (selectedFileRef.current) {
      fd.set("photo", selectedFileRef.current);
    }

    try {
      const result = await updateProfile(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      selectedFileRef.current = null;
      // Keep previewUrl — it shows the correct image while router.refresh()
      // fetches the new server URL. Cleared above when profile.image updates.
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setName(profile.name);
    setPreviewUrl(null);
    selectedFileRef.current = null;
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Home
      </Link>

      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div className="group relative">
            {displayImage ? (
              <img
                src={displayImage}
                alt={profile.name}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-background"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground ring-4 ring-background">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100"
                >
                  <Camera className="size-5 text-white" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}
          </div>

          {/* Name */}
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-4 max-w-xs text-center text-lg font-semibold"
              maxLength={50}
              autoFocus
            />
          ) : (
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              {profile.name}
            </h1>
          )}

          {/* Handle */}
          <p className="mt-1 text-sm text-muted-foreground">
            @{profile.handle}
          </p>

          {/* Joined date */}
          <p className="mt-2 text-xs text-muted-foreground">
            Joined {formatJoinDate(profile.createdAt)}
          </p>

          {/* Actions */}
          {isOwner && (
            <div className="mt-6">
              {editing ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={submitting || name.trim().length === 0}
                  >
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="gap-1.5"
                >
                  <Pencil className="size-3.5" />
                  Edit profile
                </Button>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          )}
        </div>
      </div>
    </main>
  );
}
