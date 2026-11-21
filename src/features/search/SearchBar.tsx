"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { useMediaDetail } from "@/features/media-detail/MediaDetailProvider";
import { useDismiss } from "@/hooks/useDismiss";
import { useMediaSearch } from "@/hooks/useMedia";
import type { Media, MediaScope } from "@/types/media";
import { cn } from "@/utils/cn";
import { SearchResults } from "./SearchResults";

const PLACEHOLDER = { all: "Search movies & series…", movie: "Search movies…", tv: "Search series…" };

/** Global live search, scoped to the section the user is browsing. */
export function SearchBar({ scope, className }: { scope: MediaScope; className?: string }) {
  const { openDetails } = useMediaDetail();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsId = useId();

  const search = useMediaSearch(query, scope);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, close, open);

  const select = (media: Media) => {
    openDetails(media);
    setOpen(false);
  };

  const expanded = open && search.isActive;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor={`${resultsId}-input`} className="sr-only">
          Search catalog
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={`${resultsId}-input`}
          type="search"
          autoComplete="off"
          value={query}
          placeholder={PLACEHOLDER[scope]}
          aria-controls={resultsId}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="glass h-12 w-full rounded-full pr-12 pl-14 text-fg placeholder:text-muted/80 transition-colors outline-none focus:border-accent/50 focus:bg-white/10 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2">
          {search.isPending ? (
            <LoaderCircle className="size-5 animate-spin text-accent" aria-label="Searching" />
          ) : (
            query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid cursor-pointer text-muted hover:text-fg">
                <X className="size-5" />
              </button>
            )
          )}
        </span>
      </form>

      {expanded && (
        <SearchResults
          id={resultsId}
          query={query.trim()}
          results={search.results}
          isPending={search.isPending}
          error={search.error}
          onSelect={select}
        />
      )}
    </div>
  );
}
