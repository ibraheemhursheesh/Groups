"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/app/actions/notifications";
import { useSession } from "@/app/lib/auth-client";
import { useRealtimeEvents } from "@/components/realtime-provider";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

type NotificationsBellProps = {
  /**
   * Custom trigger, given the current unread count so it can show its own
   * badge. Defaults to the standalone outline bell button used in the header.
   */
  renderTrigger?: (unreadCount: number) => React.ReactNode;
  /** Which side the panel opens toward — "top" for the bottom nav. */
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  contentClassName?: string;
};

export function NotificationsBell({
  renderTrigger,
  side,
  align = "end",
  contentClassName = "w-80",
}: NotificationsBellProps = {}) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Frozen at open time so rows you are *currently* reading keep their "new"
  // treatment even though opening the panel has already marked them read.
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const feed = await getNotifications();
    setItems(feed.items);
    setUnreadCount(feed.unreadCount);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void refresh();
  }, [userId, refresh]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (event.kind !== "notifications-changed") return;
        void refresh();
      },
      [refresh],
    ),
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setHighlighted(new Set());
      return;
    }

    setHighlighted(
      new Set(items.filter((item) => !item.read).map((item) => item.id)),
    );
    if (unreadCount === 0) return;

    setUnreadCount(0);
    void markNotificationsRead().then(refresh);
  };

  if (!userId) return null;

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger(unreadCount)
        ) : (
          <Button variant="outline" size="sm" className="relative gap-1.5">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side={side} align={align} className={contentClassName}>
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Notifications
        </p>

        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {loaded ? "Nothing yet." : "Loading…"}
          </p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={`/groups/${item.groupId}/post/${item.postId}`}
                className={cn(
                  "flex cursor-pointer items-start gap-2 py-2",
                  (!item.read || highlighted.has(item.id)) && "bg-accent/50",
                )}
              >
                <ActorAvatars
                  images={item.actorImages}
                  total={item.actorCount}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm leading-snug">{item.text}</span>
                  {item.postPreview && (
                    <span className="truncate text-xs text-muted-foreground">
                      {item.postPreview}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {timeAgo(new Date(item.updatedAt))}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActorAvatars({
  images,
  total,
}: {
  images: (string | null)[];
  total: number;
}) {
  const shown = images.slice(0, 2);

  return (
    <span className="flex shrink-0 -space-x-2 pt-0.5">
      {shown.map((image, index) =>
        image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={image}
            alt=""
            className="h-6 w-6 rounded-full border border-background object-cover"
          />
        ) : (
          <span
            key={index}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-background bg-muted text-[10px]"
          >
            {total > 1 ? "•" : ""}
          </span>
        ),
      )}
    </span>
  );
}
