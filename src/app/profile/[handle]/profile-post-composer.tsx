"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { ProfilePostForm } from "./profile-post-form";
import { VaulDrawer, useIsMobile } from "@/components/ui/vaul-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ProfilePostComposerProps {
  onOptimisticSubmit: (formData: FormData) => void;
}

export function ProfilePostComposer({
  onOptimisticSubmit,
}: ProfilePostComposerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleSubmit = (fd: FormData) => {
    onOptimisticSubmit(fd);
    setOpen(false);
  };

  const trigger = (
    <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
      <PlusIcon className="size-5" />
      <span className="sr-only">New profile post</span>
    </Button>
  );

  if (isMobile) {
    return (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <VaulDrawer open={open} onOpenChange={setOpen} trigger={trigger}>
          <h2 className="mb-3 text-lg font-semibold">New post</h2>
          <ProfilePostForm onOptimisticSubmit={handleSubmit} />
        </VaulDrawer>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
            <DialogDescription>
              Share something on your profile.
            </DialogDescription>
          </DialogHeader>
          <ProfilePostForm onOptimisticSubmit={handleSubmit} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
