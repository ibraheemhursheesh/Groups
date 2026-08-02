"use client";

import { Button } from "@/components/ui/button";
import { deleteGroup, leaveGroup } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GroupActions({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  return (
    <div className="mt-8 border-t pt-6">
      {isAdmin ? (
        <DeleteGroupButton groupId={groupId} />
      ) : (
        <LeaveGroupButton groupId={groupId} />
      )}
    </div>
  );
}

function LeaveGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLeave = async () => {
    setLoading(true);
    await leaveGroup(groupId);
    setLoading(false);
    router.push("/");
  };

  return (
    <Button variant="outline" onClick={handleLeave} disabled={loading}>
      {loading ? "Leaving..." : "Leave group"}
    </Button>
  );
}

function DeleteGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    await deleteGroup(groupId);
    setLoading(false);
    router.push("/");
  };

  if (!confirming) {
    return (
      <Button variant="destructive" onClick={() => setConfirming(true)}>
        Delete group
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-destructive">Are you sure? This cannot be undone.</span>
      <Button variant="destructive" onClick={handleDelete} disabled={loading}>
        {loading ? "Deleting..." : "Confirm delete"}
      </Button>
      <Button variant="outline" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
