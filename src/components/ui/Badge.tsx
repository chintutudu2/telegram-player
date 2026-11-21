import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface BadgeProps {
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
  children: ReactNode;
}

/** Frosted metadata chip used over artwork (runtime, year, rating…). */
export function Badge({ icon: Icon, iconClassName, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md sm:text-sm",
        className,
      )}
    >
      {Icon && <Icon aria-hidden className={cn("size-3.5 sm:size-4", iconClassName)} />}
      {children}
    </span>
  );
}
