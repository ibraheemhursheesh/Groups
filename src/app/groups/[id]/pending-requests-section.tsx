"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { handleJoinRequest } from "@/app/actions/groups";

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
  const [optimisticRequests, setRequests] = useState(requests);

  if (optimisticRequests.length === 0) return null;

  const approve = async (requestId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    await handleJoinRequest(requestId, groupId, "approve");
  };

  const reject = async (requestId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    await handleJoinRequest(requestId, groupId, "reject");
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
              <Button variant="default" size="sm" onClick={() => approve(req.id)}>
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={() => reject(req.id)}>
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
