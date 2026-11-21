"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";
import type { Media } from "@/types/media";
import { MediaCard } from "./MediaCard";
import { SectionHeading } from "./SectionHeading";

interface MediaRowProps {
  title: string;
  icon?: ReactNode;
  items: readonly Media[];
  viewAllHref?: string;
}

/** Horizontally scrolling carousel with snap points and arrow controls. */
export function MediaRow({ title, icon, items, viewAllHref }: MediaRowProps) {
  const { ref, atStart, atEnd, scrollBy } = useHorizontalScroll<HTMLUListElement>();

  if (items.length === 0) return null;

  const arrows = (
    <div className="hidden gap-2 sm:flex">
      <Button size="icon" aria-label={`Scroll ${title} left`} disabled={atStart} onClick={() => scrollBy(-1)} className="size-9">
        <ChevronLeft className="size-4" />
      </Button>
      <Button size="icon" aria-label={`Scroll ${title} right`} disabled={atEnd} onClick={() => scrollBy(1)} className="size-9">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );

  return (
    <section className="space-y-2">
      <SectionHeading title={title} icon={icon} viewAllHref={viewAllHref} actions={arrows} />
      {/* Vertical padding leaves room for the hover scale inside the scroll clip. */}
      <ul
        ref={ref}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-4 sm:gap-5"
      >
        {items.map((media) => (
          <li key={media.id} className="w-40 shrink-0 snap-start sm:w-48 lg:w-52">
            <MediaCard media={media} sizes="208px" />
          </li>
        ))}
      </ul>
    </section>
  );
}
