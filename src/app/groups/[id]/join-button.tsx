"use client";

import { Button } from "@/components/ui/button";
import { requestToJoin } from "@/app/actions/groups";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type View = "idle" | "pending";

export function JoinButton({
  groupId,
  hasExistingRequest,
  isPublic,
}: {
  groupId: string;
  hasExistingRequest: boolean;
  isPublic: boolean;
}) {
  const [realView, setRealView] = useState<View>(
    hasExistingRequest ? "pending" : "idle",
  );
  const [optimisticView, setOptimisticView] = useOptimistic(
    realView,
    (_: View, next: View) => next,
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleJoin = () => {
    startTransition(async () => {
      setOptimisticView("pending");
      try {
        await requestToJoin(groupId);
        if (isPublic) {
          router.refresh();
        } else {
          setRealView("pending");
        }
      } catch {
        setRealView("idle");
      }
    });
  };

  if (optimisticView === "pending") {
    if (isPublic) return null;
    return (
      <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
        Your join request is pending admin approval.
      </p>
    );
  }

  return (
    <Button onClick={handleJoin} disabled={isPending}>
      {isPending ? "Joining..." : isPublic ? "Join" : "Request to join"}
    </Button>
  );
}
