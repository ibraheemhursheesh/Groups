"use client";

import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/app/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserRound, X } from "lucide-react";

type Session = {
  session: {
    token: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

export function AccountSwitcher() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeToken, setActiveToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await authClient.multiSession.listDeviceSessions();
    if (data) {
      setSessions(data as Session[]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchTo = async (token: string) => {
    await authClient.multiSession.setActive({ sessionToken: token });
    setActiveToken(token);
    window.location.reload();
  };

  const revoke = async (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await authClient.multiSession.revoke({ sessionToken: token });
    refresh();
  };

  if (sessions.length === 0) return null;

  if (sessions.length === 1) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => { window.location.href = "/?add-account=true"; }}
      >
        <UserRound className="size-4" />
        Add account
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserRound className="size-4" />
            Switch account
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Active sessions
        </p>
        {sessions.map((s) => (
          <DropdownMenuItem
            key={s.session.token}
            onClick={() => switchTo(s.session.token)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {s.user.image ? (
                <img src={s.user.image} alt="" className="h-5 w-5 rounded-full" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
                  {(s.user.name || s.user.email).charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate text-sm">
                {s.user.name || s.user.email}
              </span>
            </div>
            <button
              onClick={(e) => revoke(s.session.token, e)}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { window.location.href = "/?add-account=true"; }}>
          Sign in to another account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
