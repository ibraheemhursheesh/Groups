"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, User } from "lucide-react";
import { useSession } from "@/app/lib/auth-client";
import { NotificationsBell } from "@/components/notifications-bell";
import { cn } from "@/lib/utils";

const itemClass = (active: boolean) =>
  cn(
    "relative flex flex-1 items-center justify-center py-3 text-muted-foreground transition-colors",
    "hover:text-foreground active:text-foreground",
    active && "text-foreground",
  );

/**
 * Sticky bottom navigation for mobile (hidden from `md` up). Renders only for a
 * signed-in user, so it never shows on the sign-in screen. Notifications reuse
 * {@link NotificationsBell} so the unread badge, realtime updates, and mark-read
 * behaviour stay in one place — here it just opens upward.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as
    | { handle?: string; image?: string | null }
    | undefined;

  if (!user) return null;

  const profileHref = user.handle ? `/profile/${user.handle}` : "/";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <Link href="/" className={itemClass(pathname === "/")} aria-label="Home">
        <Home className="size-6" />
      </Link>

      <NotificationsBell
        side="top"
        align="center"
        contentClassName="max-h-[70vh] w-[92vw] max-w-sm overflow-y-auto"
        renderTrigger={(unreadCount) => (
          <button
            type="button"
            className={cn(itemClass(false), "cursor-pointer")}
            aria-label="Notifications"
          >
            <Bell className="size-6" />
            {unreadCount > 0 && (
              <span className="absolute right-[calc(50%-1.25rem)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        )}
      />

      <Link
        href={profileHref}
        className={itemClass(pathname === profileHref)}
        aria-label="Profile"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className={cn(
              "size-6 rounded-full object-cover",
              pathname === profileHref && "ring-2 ring-foreground",
            )}
          />
        ) : (
          <User className="size-6" />
        )}
      </Link>
    </nav>
  );
}
