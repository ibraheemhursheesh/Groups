"use client";

import { Button } from "@/components/ui/button";
import { leaveGroup } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GroupActions({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  if (isAdmin) return null;

  return (
    <div className="mt-8 border-t pt-6">
      <LeaveGroupButton groupId={groupId} />
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
