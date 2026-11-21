"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * Native `<dialog>` modal: focus trapping, Escape handling and top-layer
 * stacking come from the platform. Clicking the backdrop closes it.
 */
export function Modal({ open, onClose, label, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-raised p-0 text-fg shadow-2xl no-scrollbar",
        className,
      )}
    >
      {open && (
        <div className="relative">
          <Button
            variant="glass"
            size="icon"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-black/40"
          >
            <X className="size-5" />
          </Button>
          {children}
        </div>
      )}
    </dialog>
  );
}
