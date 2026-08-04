"use client";

import { useState } from "react";
import { switchToTestUser } from "@/app/actions/dev-auth";
import { Button } from "@/components/ui/button";
import { ChevronUp, User2Icon } from "lucide-react";

const USERS = [
  { id: "test-admin-001", label: "Alex (Admin)" },
  { id: "test-member-001", label: "Jordan (Member)" },
  { id: "test-member-002", label: "Casey (Member)" },
];

export function DevAccountSwitcher() {
  if (process.env.NODE_ENV !== "development") return null;

  const [open, setOpen] = useState(false);

  const switchTo = async (userId: string) => {
    await switchToTestUser(userId);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 rounded-xl border bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Switch account
          </p>
          {USERS.map((u) => (
            <button
              key={u.id}
              onClick={() => switchTo(u.id)}
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {u.label}
            </button>
          ))}
        </div>
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(!open)}
        className="gap-1 shadow-lg"
      >
        <User2Icon className="size-4" />
        Dev
        <ChevronUp
          className={`size-3 transition ${open ? "" : "rotate-180"}`}
        />
      </Button>
    </div>
  );
}
