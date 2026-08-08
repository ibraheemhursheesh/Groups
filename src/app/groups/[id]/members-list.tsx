"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { kickMember } from "@/app/actions/groups";

type Member = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  role: string;
};

export function MembersList({
  members,
  currentUserId,
  isAdmin,
  groupId,
}: {
  members: Member[];
  currentUserId: string;
  isAdmin: boolean;
  groupId: string;
}) {
  const [open, setOpen] = useState(false);
  const [localMembers, setLocalMembers] = useState(members.filter((m) => m.role !== "admin"));

  const displayMembers = localMembers.slice(0, 10);

  const handleKick = async (memberId: string) => {
    setLocalMembers((prev) => prev.filter((m) => m.id !== memberId));
    await kickMember(memberId, groupId);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-1"
      >
        <div className="flex -space-x-2">
          {displayMembers.map((m) => (
            m.userImage ? (
              <img
                key={m.userId}
                src={m.userImage}
                alt={m.userName || ""}
                className="h-7 w-7 rounded-full border-2 border-background object-cover ring-1 ring-border"
              />
            ) : (
              <div
                key={m.userId}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs text-muted-foreground ring-1 ring-border"
              >
                {(m.userName || m.userId).charAt(0).toUpperCase()}
              </div>
            )
          ))}
          {localMembers.length > 10 && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] text-muted-foreground ring-1 ring-border">
              +{localMembers.length - 10}
            </div>
          )}
        </div>
        <span className="ml-1 text-sm text-muted-foreground group-hover:text-foreground">
          {localMembers.length} member{localMembers.length !== 1 ? "s" : ""}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Members</DialogTitle>
            <DialogDescription>
              {localMembers.length} member{localMembers.length !== 1 ? "s" : ""} in this group
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {localMembers.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  {m.userImage ? (
                    <img
                      src={m.userImage}
                      alt={m.userName || ""}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                      {(m.userName || m.userId).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium">
                    {m.userName || m.userId}
                    {m.userId === currentUserId && " (you)"}
                  </span>
                </div>
                {isAdmin && m.userId !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleKick(m.id)}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    Kick
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
