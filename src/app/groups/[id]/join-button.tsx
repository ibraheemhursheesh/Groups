"use client";

import { Button } from "@/components/ui/button";
import { requestToJoin } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    await requestToJoin(groupId);
    setLoading(false);
    router.refresh();
  };

  return (
    <Button onClick={handleJoin} disabled={loading}>
      {loading ? "Requesting..." : "Request to join"}
    </Button>
  );
}
