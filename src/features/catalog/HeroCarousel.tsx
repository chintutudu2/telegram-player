"use client";

import { ChevronRight, Info, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { useMediaDetail } from "@/features/media-detail/MediaDetailProvider";
import { PlayLink } from "@/features/watch/PlayLink";
import { useCarousel } from "@/hooks/useCarousel";
import type { Media } from "@/types/media";
import { cn } from "@/utils/cn";
import { MetaBadges } from "./MetaBadges";

interface HeroCarouselProps {
  items: readonly Media[];
  label?: string;
}

function Dots({ count, index, onSelect, className }: { count: number; index: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Show slide ${i + 1}`}
          aria-current={i === index}
          onClick={() => onSelect(i)}
          className={cn(
            "h-2.5 cursor-pointer rounded-full transition-all duration-300",
            i === index ? "w-12 bg-accent shadow-glow" : "w-2.5 bg-accent-deep/70 hover:bg-accent-soft",
          )}
        />
      ))}
    </div>
  );
}

/** Cinematic featured banner with a stacked "up next" peek on wide screens. */
export function HeroCarousel({ items, label = "Featured" }: HeroCarouselProps) {
  const { openDetails } = useMediaDetail();
  const { index, at, goTo, next, pause, resume } = useCarousel(items.length);

  if (items.length === 0) return null;
  const current = items[index];
  const peeks = items.length > 1 ? [items[at(1)], items[at(2)]] : [];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className="relative flex"
    >
      {/* Main slide */}
      <div className="relative z-10 h-[340px] min-w-0 flex-1 overflow-hidden rounded-[2rem] shadow-card sm:h-[380px] lg:h-[460px]">
        {items.map((media, i) => (
          <div
            key={media.id}
            aria-hidden={i !== index}
            // Crossfade plus a slow zoom: the incoming slide settles from 110%
            // over the slide's lifetime; the outgoing one drifts forward as it fades.
            className={cn(
              "absolute inset-0 [transition:opacity_1s_ease,scale_7s_ease-out]",
              i === index ? "scale-100 opacity-100" : "scale-110 opacity-0",
            )}
          >
            <MediaImage
              src={media.backdropUrl ?? media.posterUrl}
              alt=""
              sizes="(min-width: 1024px) 70vw, 100vw"
              preload={i === 0}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-linear-to-t from-[#0a5f69]/90 via-[#0a5f69]/10 to-black/20" />
        <div className="absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-transparent" />

        <MetaBadges
          key={`badges:${current.id}`}
          media={current}
          fields={["duration", "year"]}
          className="absolute top-5 left-5 animate-fade-in"
        />
        <Dots count={items.length} index={index} onSelect={goTo} className="absolute top-6 right-5 md:hidden" />

        <PlayLink
          media={current}
          aria-label={`Play ${current.title}`}
          className="glass absolute top-1/2 left-1/2 grid size-16 -translate-1/2 place-items-center rounded-full text-white transition-all duration-300 hover:scale-110 hover:shadow-glow sm:size-20"
        >
          <Play className="ml-1 size-7 fill-current sm:size-8" aria-hidden />
        </PlayLink>

        {/* Keyed per slide so the text rises in again on every change. */}
        <div
          key={`caption:${current.id}`}
          className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"
        >
          <div className="min-w-0 space-y-3">
            <h2 className="animate-rise-in truncate text-3xl font-semibold text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
              {current.title}
            </h2>
            <div className="flex animate-rise-in flex-wrap items-center gap-2 [animation-delay:120ms]">
              <Button variant="glass" size="sm" onClick={() => openDetails(current)} className="bg-black/25">
                <Info className="size-4" aria-hidden />
                More info
              </Button>
              <MetaBadges media={current} fields={["rating", "votes"]} className="sm:hidden" />
            </div>
          </div>
          <MetaBadges
            media={current}
            fields={["rating", "votes"]}
            className="hidden shrink-0 animate-rise-in [animation-delay:200ms] sm:flex"
          />
        </div>
      </div>

      {/* Up-next peek stack */}
      {peeks.length > 0 && (
        <div className="relative hidden w-40 shrink-0 md:block lg:w-56 xl:w-64">
          <Dots count={items.length} index={index} onSelect={goTo} className="absolute top-1 right-2 z-20" />
          {peeks.map((media, i) => (
            <button
              key={`${media.id}-${i}`}
              type="button"
              onClick={() => goTo(at(i + 1))}
              aria-label={`Show ${media.title}`}
              className={cn(
                "absolute animate-fade-in cursor-pointer overflow-hidden rounded-r-[2rem] transition-all duration-500 hover:brightness-110",
                i === 0 ? "top-[9%] -left-8 z-[5] h-[84%] w-[70%] opacity-90" : "top-[15%] left-[45%] h-[72%] w-[50%] opacity-50",
              )}
            >
              <MediaImage src={media.posterUrl} alt="" sizes="200px" />
              <div className="absolute inset-0 bg-linear-to-r from-ink/60 to-transparent" />
            </button>
          ))}
          <Button
            size="icon"
            aria-label="Next slide"
            onClick={next}
            className="absolute top-1/2 right-2 z-20 size-14 -translate-y-1/2 bg-ink/40"
          >
            <ChevronRight className="size-6" />
          </Button>
        </div>
      )}
    </section>
  );
}
