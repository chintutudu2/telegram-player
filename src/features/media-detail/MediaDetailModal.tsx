"use client";

import { Play } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";
import { Modal } from "@/components/ui/Modal";
import { MetaBadges } from "@/features/catalog/MetaBadges";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { PlayLink } from "@/features/watch/PlayLink";
import { useMediaDetails } from "@/hooks/useMedia";
import type { Media, MediaDetails } from "@/types/media";
import { formatSeasons } from "@/utils/format";

interface MediaDetailModalProps {
  media: Media | null;
  onClose: () => void;
}

export function MediaDetailModal({ media, onClose }: MediaDetailModalProps) {
  return (
    <Modal open={media !== null} onClose={onClose} label={media?.title ?? "Media details"}>
      {/* Keyed so details reset when another title opens. */}
      {media && <DetailContent key={media.id} media={media} onClose={onClose} />}
    </Modal>
  );
}

/** Title info. Playback happens on the full-screen watch page. */
function DetailContent({ media, onClose }: { media: Media; onClose: () => void }) {
  const { details } = useMediaDetails(media);
  const item: MediaDetails = details ?? media;
  const seasons = item.type === "tv" ? formatSeasons(item) : null;

  return (
    <article>
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <MediaImage src={item.backdropUrl ?? item.posterUrl} alt="" sizes="(min-width: 896px) 896px, 100vw" />
        <div className="absolute inset-0 bg-linear-to-t from-raised via-raised/20 to-transparent" />
        <PlayLink
          media={media}
          onClick={onClose}
          aria-label={`Play ${item.title}`}
          className="glass absolute top-1/2 left-1/2 grid size-20 -translate-1/2 place-items-center rounded-full text-white transition-all duration-300 hover:scale-110 hover:shadow-glow"
        >
          <Play className="ml-1 size-8 fill-current" aria-hidden />
        </PlayLink>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h2 className="text-2xl font-semibold sm:text-3xl">{item.title}</h2>
            {item.tagline && <p className="text-muted italic">{item.tagline}</p>}
          </div>
          <FavoriteButton media={media} withLabel />
        </header>

        <MetaBadges media={item} fields={["type", "year", "duration", "rating", "votes"]} />

        {seasons && <p className="text-sm font-medium text-accent">{seasons}</p>}

        {item.genres.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Genres">
            {item.genres.map((genre) => (
              <li key={genre} className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                {genre}
              </li>
            ))}
          </ul>
        )}

        <p className="leading-relaxed text-fg/85">{item.overview || "No synopsis available."}</p>
      </div>
    </article>
  );
}
