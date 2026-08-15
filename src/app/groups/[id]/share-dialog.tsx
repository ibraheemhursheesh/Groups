"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VaulDrawer, useIsMobile } from "@/components/ui/vaul-drawer";
import { PostImages } from "./post-images";
import { timeAgo } from "@/lib/utils";

type SharePostPreview = {
  userName: string | null;
  userImage: string | null;
  content: string;
  images: string[];
  createdAt: Date;
};

interface ShareDialogProps {
  originalPostId: string;
  originalPost: SharePostPreview;
  groupId: string;
  onShare: (formData: FormData) => void;
}

export function ShareDialog({ originalPostId, originalPost, groupId, onShare }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const isMobile = useIsMobile();

  const handleSubmit = () => {
    const formData = new FormData();
    formData.set("groupId", groupId);
    formData.set("content", text);
    formData.set("originalPostId", originalPostId);
    formData.set("origContent", originalPost.content);
    formData.set("origImages", JSON.stringify(originalPost.images));
    formData.set("origUserName", originalPost.userName || "");
    formData.set("origUserImage", originalPost.userImage || "");
    formData.set("origCreatedAt", originalPost.createdAt.toISOString());
    onShare(formData);
    setOpen(false);
    setText("");
  };

  const formContent = (
    <div>
      {" "}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
        rows={2}
        className="mb-2.5"
      />
      <div className="mb-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          {originalPost.userImage ? (
            <img
              src={originalPost.userImage}
              alt=""
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
              {(originalPost.userName || "").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {originalPost.userName} ·{" "}
            {timeAgo(new Date(originalPost.createdAt))}
          </span>
        </div>
        {originalPost.content && (
          <p className="text-sm whitespace-pre-wrap">{originalPost.content}</p>
        )}
        {originalPost.images.length > 0 && (
          <div className="mt-2">
            <PostImages images={originalPost.images} />
          </div>
        )}
      </div>
      <Button onClick={handleSubmit} className="mt-3 w-full">
        Share
      </Button>
    </div>
  );

  const trigger = (
    <button className="py-2 px-5 flex items-center gap-1.5 text-xs transition hover:text-green-500 hover:bg-green-100 rounded-md">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-share2 size-4"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
    </button>
  );

  if (isMobile) {
    return (
      <VaulDrawer open={open} onOpenChange={setOpen} trigger={trigger}>
        <h2 className="mb-3 text-lg font-semibold">Share post</h2>
        {formContent}
      </VaulDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Share post</DialogTitle>
          <DialogDescription>
            Add your thoughts and share this post with the group.
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
