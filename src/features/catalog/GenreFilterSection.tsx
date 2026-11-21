"use client";

import { Pill } from "@/components/ui/Pill";
import { useGenreFilter } from "@/hooks/useGenreFilter";
import type { Media } from "@/types/media";
import { MediaGrid } from "./MediaGrid";
import { SectionHeading } from "./SectionHeading";

interface GenreFilterSectionProps {
  title: string;
  items: readonly Media[];
  viewAllHref?: string;
  /** Max cards shown; omit to show every match. */
  limit?: number;
}

/** Category pills that filter a media grid in place. */
export function GenreFilterSection({ title, items, viewAllHref, limit }: GenreFilterSectionProps) {
  const { genres, selected, select, filtered } = useGenreFilter(items);
  const visible = limit ? filtered.slice(0, limit) : filtered;

  return (
    <section className="space-y-5">
      <SectionHeading title={title} viewAllHref={viewAllHref} />
      <div role="group" aria-label="Filter by genre" className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {genres.map((genre) => (
          <Pill key={genre} active={genre === selected} onClick={() => select(genre)}>
            {genre}
          </Pill>
        ))}
      </div>
      <MediaGrid items={visible} />
    </section>
  );
}
