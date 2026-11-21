"use client";

import { Layers, Star } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";
import { TitlePoster } from "@/features/catalog/TitlePoster";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { useMediaDetail } from "@/features/media-detail/MediaDetailProvider";
import type { Media } from "@/types/media";
import { cn } from "@/utils/cn";
import { formatCompact, formatRating, formatRuntime } from "@/utils/format";

/** Corner indicator: season/episode count for series, runtime for films. */
function cornerLabel(media: Media): string | null {
  if (media.type === "tv") {
    if (!media.seasons) return "Series";
    return media.episodes ? `S${media.seasons} · ${media.episodes} EP` : `S${media.seasons}`;
  }
  return media.runtime ? formatRuntime(media.runtime) : null;
}

interface MediaCardProps {
  media: Media;
  /** `sizes` hint for the poster; depends on the layout hosting the card. */
  sizes?: string;
  className?: string;
}

export function MediaCard({ media, sizes = "(min-width: 1024px) 220px, 45vw", className }: MediaCardProps) {
  const { openDetails } = useMediaDetail();
  const corner = cornerLabel(media);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl bg-card shadow-card transition-all duration-300 hover:scale-105 hover:shadow-glow focus-within:scale-105 focus-within:shadow-glow",
        className,
      )}
    >
      <div className="relative aspect-4/5 overflow-hidden">
        <MediaImage
          src={media.posterUrl}
          alt=""
          sizes={sizes}
          className="transition-transform duration-500 group-hover:scale-110"
          fallback={<TitlePoster media={media} />}
        />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-card via-card/50 to-transparent" />
        {corner && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            {media.type === "tv" && <Layers className="size-3 text-accent" aria-hidden />}
            {corner}
          </span>
        )}
      </div>

      <div className="relative -mt-2 px-3 pb-4 text-center">
        <h3 className="truncate text-[15px] font-medium text-white sm:text-base">{media.title}</h3>
        <p className="mt-0.5 flex items-center justify-center gap-1 truncate text-xs text-white/80">
          {media.rating > 0 ? (
            <>
              <Star className="size-3.5 fill-star text-star" aria-hidden />
              <span className="sr-only">Rated</span>
              {formatRating(media.rating)}
              <span className="text-white/60">({formatCompact(media.voteCount)} reviews)</span>
            </>
          ) : (
            // Library uploads without TMDB enrichment have no rating yet.
            [media.genres[0], media.releaseYear].filter(Boolean).join(" · ") || "New upload"
          )}
        </p>
      </div>

      {/* Stretched primary action; the favorite toggle sits above it. */}
      <button
        type="button"
        onClick={() => openDetails(media)}
        aria-label={`View details for ${media.title}`}
        className="absolute inset-0 z-10 cursor-pointer rounded-3xl focus-visible:outline-offset-[-2px]"
      />
      <FavoriteButton
        media={media}
        className="absolute top-3 right-3 z-20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      />
    </article>
  );
}
