"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { interactive, tone } from "@/components/ui/styles";
import { activeSection, catalogSections } from "@/config/navigation";
import { useDismiss } from "@/hooks/useDismiss";
import { cn } from "@/utils/cn";
import { Logo } from "./Logo";
import { PathnameBoundary } from "./PathnameBoundary";

const itemClass = "flex h-14 items-center gap-3.5 rounded-full px-6 text-[17px]";

/** All / Movies / Series — the app's catalog sections. */
function SectionNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const current = activeSection(pathname);
  return (
    <ul className="space-y-3">
      {catalogSections.map((item) => {
        const active = item.href === current?.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(itemClass, interactive, active ? tone.active : tone.idle)}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Optional footer (e.g. data-source attribution). */
  footer?: ReactNode;
}

/** Fixed rail on desktop; off-canvas drawer below `lg`. */
export function Sidebar({ open, onClose, footer }: SidebarProps) {
  const ref = useRef<HTMLElement>(null);
  useDismiss(ref, onClose, open);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        ref={ref}
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/5 bg-surface/80 px-5 py-7 backdrop-blur-md transition-[translate,visibility] duration-300 xl:w-80",
          open ? "translate-x-0" : "max-lg:invisible max-lg:-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Logo onNavigate={onClose} />
          <Button variant="ghost" size="icon" aria-label="Close menu" onClick={onClose} className="lg:hidden">
            <X className="size-5" />
          </Button>
        </div>

        <nav className="no-scrollbar mt-12 flex flex-1 flex-col overflow-y-auto">
          <PathnameBoundary>{(pathname) => <SectionNav pathname={pathname} onNavigate={onClose} />}</PathnameBoundary>
        </nav>

        {footer}
      </aside>
    </>
  );
}
