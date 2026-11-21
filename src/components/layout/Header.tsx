"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { activeSection, catalogSections, sectionForPath } from "@/config/navigation";
import { SearchBar } from "@/features/search/SearchBar";
import { cn } from "@/utils/cn";
import { Logo } from "./Logo";
import { PathnameBoundary } from "./PathnameBoundary";

/** Home / Movies / Series. */
function SectionNav({ pathname }: { pathname: string }) {
  const current = activeSection(pathname);
  return (
    <nav aria-label="Main navigation">
      <ul className="flex items-center gap-1 sm:gap-2">
        {catalogSections.map((item) => {
          const active = item.href === current?.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center rounded-full px-3 text-sm font-medium transition-colors duration-300 sm:px-4 sm:text-[15px]",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-accent shadow-glow sm:inset-x-4"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Top bar: logo, section links, scoped search and the account menu. */
export function Header({ profile }: { profile?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/70 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8 lg:py-4">
      <PathnameBoundary>
        {(pathname) => {
          // Search is scoped to the section being browsed (All / Movies / Series).
          const scope = sectionForPath(pathname).scope;
          // One row on md+; below that the search wraps onto its own full-width row.
          return (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-4 lg:gap-x-8">
              <Logo showMark={false} />
              <SectionNav pathname={pathname} />
              <SearchBar
                scope={scope}
                className="order-last w-full md:order-none md:ml-auto md:w-auto md:max-w-md md:min-w-0 md:flex-1"
              />
              <div className="ml-auto md:ml-0">{profile}</div>
            </div>
          );
        }}
      </PathnameBoundary>
    </header>
  );
}
