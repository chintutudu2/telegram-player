import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-3xl bg-white/5", className)} />;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center",
        className,
      )}
    >
      <span className="grid size-16 place-items-center rounded-full bg-accent/10 text-accent shadow-glow">
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="max-w-md space-y-1.5">
        <h2 className="text-xl font-semibold text-fg">{title}</h2>
        <p className="text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Visually hide the heading when the page hero already titles the view. */
  hidden?: boolean;
}

export function PageHeader({ title, description, hidden }: PageHeaderProps) {
  if (hidden) return <h1 className="sr-only">{title}</h1>;
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold text-fg sm:text-3xl">{title}</h1>
      {description && <p className="text-muted">{description}</p>}
    </header>
  );
}
