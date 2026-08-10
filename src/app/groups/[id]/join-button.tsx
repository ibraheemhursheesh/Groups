"use client";

import { Button } from "@/components/ui/button";
import { requestToJoin } from "@/app/actions/groups";
import { useOptimistic, useState, useTransition } from "react";

type View = "idle" | "pending";

export function JoinButton({
  groupId,
  hasExistingRequest,
}: {
  groupId: string;
  hasExistingRequest: boolean;
}) {
  const [realView, setRealView] = useState<View>(
    hasExistingRequest ? "pending" : "idle",
  );
  const [optimisticView, setOptimisticView] = useOptimistic(
    realView,
    (_: View, next: View) => next,
  );
  const [isPending, startTransition] = useTransition();

  const handleJoin = () => {
    startTransition(async () => {
      setOptimisticView("pending");

      try {
        await requestToJoin(groupId);
        setRealView("pending");
      } catch {
        setRealView("idle");
      }
    });
  };

  if (optimisticView === "pending") {
    return (
      <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
        {isPending
          ? "Sending your join request..."
          : "Your join request is pending admin approval."}
      </p>
    );
  }

  return (
    <Button onClick={handleJoin} disabled={isPending}>
      Request to join
    </Button>
  );
}
