"use client";

import { LogOut } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { useDismiss } from "@/hooks/useDismiss";
import { signOut } from "@/services/auth/auth.actions";
import { cn } from "@/utils/cn";

const avatarClass = "grid size-10 shrink-0 place-items-center rounded-full";

/** Same footprint as the avatar, shown while the session streams in. */
export function ProfileMenuPlaceholder() {
  return <span aria-hidden className={cn(avatarClass, "animate-pulse bg-white/10")} />;
}

/** Avatar with the viewer's initial; opens a small account menu. */
export function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Account menu for ${email}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          avatarClass,
          "cursor-pointer bg-linear-to-br from-accent to-accent-deep text-lg font-semibold text-ink transition-all duration-300 hover:shadow-glow",
          open && "shadow-glow ring-2 ring-accent/60 ring-offset-2 ring-offset-ink",
        )}
      >
        {initial}
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-40 mt-3 w-64 overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-white/5 p-4">
            <span aria-hidden className={cn(avatarClass, "bg-linear-to-br from-accent to-accent-deep font-semibold text-ink")}>
              {initial}
            </span>
            <p className="min-w-0 truncate text-sm text-fg" title={email}>
              {email}
            </p>
          </div>
          <form action={signOut} className="p-2">
            <button
              type="submit"
              className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-muted transition-colors hover:bg-white/5 hover:text-fg"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
