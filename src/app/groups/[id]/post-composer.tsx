"use client";

import { useState } from "react";
import { PostForm } from "./post-form";
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
import { PlusIcon } from "lucide-react";

interface PostComposerProps {
  groupId: string;
  isAdmin: boolean;
  onOptimisticSubmit: (formData: FormData) => void;
}

export function PostComposer({ groupId, isAdmin, onOptimisticSubmit }: PostComposerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleSubmit = (fd: FormData) => {
    onOptimisticSubmit(fd);
    setOpen(false);
  };

  const trigger = (
    <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
      <PlusIcon className="size-5" />
    </Button>
  );

  if (isMobile) {
    return (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <VaulDrawer open={open} onOpenChange={setOpen} trigger={trigger}>
          <h2 className="mb-3 text-lg font-semibold">New post</h2>
          <PostForm groupId={groupId} isAdmin={isAdmin} onOptimisticSubmit={handleSubmit} />
        </VaulDrawer>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
            <DialogDescription>
              Share something with the group.
            </DialogDescription>
          </DialogHeader>
          <PostForm groupId={groupId} isAdmin={isAdmin} onOptimisticSubmit={handleSubmit} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
