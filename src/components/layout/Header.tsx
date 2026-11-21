"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sectionForPath } from "@/config/navigation";
import { SearchBar } from "@/features/search/SearchBar";
import { PathnameBoundary } from "./PathnameBoundary";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/70 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8 lg:py-5">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="glass" size="icon" aria-label="Open menu" onClick={onMenuClick} className="size-12 lg:hidden">
          <Menu className="size-5" />
        </Button>
        {/* Search is scoped to the section being browsed (All / Movies / Series). */}
        <PathnameBoundary>
          {(pathname) => <SearchBar scope={sectionForPath(pathname).scope} className="min-w-0 flex-1" />}
        </PathnameBoundary>
      </div>
    </header>
  );
}
