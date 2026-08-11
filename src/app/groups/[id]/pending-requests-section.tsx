"use client";

import { Button } from "@/components/ui/button";

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
  return (
    <div className="rounded-xl border p-4">
      {/* <h3 className="mb-3 font-semibold">
        Pending join requests ({requests.length})
      </h3> */}
      <ul className="space-y-3">
        {requests.map((req) => (
          <li
            key={req.id}
            className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              {req.userImage ? (
                <img
                  src={req.userImage}
                  alt={req.userName || ""}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  {(req.userName || req.userId).charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium">
                {req.userName || req.userId}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => onApprove(req.id)}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(req.id)}
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
