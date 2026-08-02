"use client";

import { Button } from "@/components/ui/button";
import { handleJoinRequest } from "@/app/actions/groups";
import { useRouter } from "next/navigation";

export function PendingRequestsSection({
  groupId,
  requests,
}: {
  groupId: string;
  requests: { id: string; userId: string; userName: string | null; userImage: string | null; createdAt: Date }[];
}) {
  const router = useRouter();

  if (requests.length === 0) return null;

  const approve = async (requestId: string) => {
    await handleJoinRequest(requestId, groupId, "approve");
    router.refresh();
  };

  const reject = async (requestId: string) => {
    await handleJoinRequest(requestId, groupId, "reject");
    router.refresh();
  };

  return (
    <div className="mb-6 rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">
        Pending join requests ({requests.length})
      </h3>
      <ul className="space-y-3">
        {requests.map((req) => (
          <li key={req.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">{req.userName || req.userId}</span>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={() => approve(req.id)}>Approve</Button>
              <Button variant="outline" size="sm" onClick={() => reject(req.id)}>Reject</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
