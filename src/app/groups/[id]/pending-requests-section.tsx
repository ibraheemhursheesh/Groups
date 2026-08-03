"use client";

import { Button } from "@/components/ui/button";
import { handleJoinRequest } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

type PendingRequest = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  createdAt: Date;
};

export function PendingRequestsSection({
  groupId,
  requests,
}: {
  groupId: string;
  requests: PendingRequest[];
}) {
  const router = useRouter();
  const [realRequests, setRealRequests] = useState(requests);
  const [optimisticRequests, removeOptimisticRequest] = useOptimistic(
    realRequests,
    (currentRequests: PendingRequest[], requestId: string) =>
      currentRequests.filter((request) => request.id !== requestId),
  );
  const [isPending, startTransition] = useTransition();

  if (optimisticRequests.length === 0) return null;

  const approve = async (requestId: string) => {
    startTransition(async () => {
      removeOptimisticRequest(requestId);

      try {
        await handleJoinRequest(requestId, groupId, "approve");
        setRealRequests((currentRequests) =>
          currentRequests.filter((request) => request.id !== requestId),
        );
        router.refresh();
      } catch {
        // Let the optimistic state roll back to the real list on failure.
      }
    });
  };

  const reject = async (requestId: string) => {
    startTransition(async () => {
      removeOptimisticRequest(requestId);

      try {
        await handleJoinRequest(requestId, groupId, "reject");
        setRealRequests((currentRequests) =>
          currentRequests.filter((request) => request.id !== requestId),
        );
        router.refresh();
      } catch {
        // Let the optimistic state roll back to the real list on failure.
      }
    });
  };

  return (
    <div className="mb-6 rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">
        Pending join requests ({optimisticRequests.length})
      </h3>
      <ul className="space-y-3">
        {optimisticRequests.map((req) => (
          <li
            key={req.id}
            className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          >
            <span className="text-sm font-medium">
              {req.userName || req.userId}
            </span>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => approve(req.id)}
                disabled={isPending}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reject(req.id)}
                disabled={isPending}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
