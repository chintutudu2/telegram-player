import Link from "next/link";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  /** Rendered element (e.g. `<Flame />`) so it can cross the server/client boundary. */
  icon?: ReactNode;
  viewAllHref?: string;
  /** Extra controls (e.g. carousel arrows) rendered on the right. */
  actions?: ReactNode;
}

export function SectionHeading({ title, icon, viewAllHref, actions }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2.5 text-xl font-medium text-fg sm:text-2xl">
        {icon && (
          <span aria-hidden className="text-accent [&>svg]:size-5">
            {icon}
          </span>
        )}
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {actions}
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm text-muted transition-colors hover:text-accent sm:text-base"
          >
            View All
          </Link>
        )}
      </div>
    </div>
  );
}
