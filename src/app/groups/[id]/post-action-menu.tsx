"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useIsMobile } from "@/components/ui/vaul-drawer";

type PostActionMenuProps = {
  /** Only the author may edit; delete is offered to owners and admins alike. */
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * Post overflow menu. On desktop it is a plain dropdown; on mobile it becomes a
 * YouTube-style bottom drawer — a rounded card that floats inset from the left,
 * right, and bottom edges rather than the full-width sheet vaul ships by
 * default (see {@link VaulDrawer}).
 */
export function PostActionMenu({
  canEdit,
  onEdit,
  onDelete,
}: PostActionMenuProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button variant="ghost" size="xs">
      <MoreHorizontal className="size-4" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          {/* The left/right space lives on Content's fixed inset (left-3/right-3)
              rather than a margin, so no child layout can stretch it away. Content
              still sits flush to the bottom edge so vaul's slide-to-close fully
              hides it; the bottom gap is the card's own mb-3. */}
          <Drawer.Content className="fixed bottom-0 left-2 right-2 z-50 outline-none">
            <div className="mb-2 overflow-hidden rounded-md bg-background pb-2 shadow-xl">
              <Drawer.Handle className="mx-auto mt-3 mb-2 bg-muted" />
              <div className="flex flex-col">
                {canEdit && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onEdit();
                    }}
                    className="flex items-center gap-5 px-5 py-3 text-left text-[15px] transition-colors hover:bg-muted active:bg-muted"
                  >
                    <Pencil className="size-5 shrink-0" />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setOpen(false);
                    onDelete();
                  }}
                  className="flex items-center gap-5 px-5 py-3 text-left text-[15px] text-red-600 transition-colors hover:bg-muted active:bg-muted"
                >
                  <Trash2 className="size-5 shrink-0" />
                  Delete
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
        <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
