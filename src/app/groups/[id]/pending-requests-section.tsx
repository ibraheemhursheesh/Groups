"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";

type PendingRequest = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  createdAt: Date;
};

export function PendingRequestsSection({
  requests,
  onApprove,
  onReject,
}: {
  requests: PendingRequest[];
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = (requestId: string) => {
    startTransition(() => {
      onApprove(requestId);
    });
  };

  const handleReject = (requestId: string) => {
    startTransition(() => {
      onReject(requestId);
    });
  };

  return (
    <div className="rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">
        Pending join requests ({requests.length})
      </h3>
      <ul className="space-y-3">
        {requests.map((req) => (
          <li
            key={req.id}
            className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          >
            <span className="text-sm font-medium">
              {req.userName || req.userId}
            </span>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={() => handleApprove(req.id)} disabled={isPending}>
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleReject(req.id)} disabled={isPending}>
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
