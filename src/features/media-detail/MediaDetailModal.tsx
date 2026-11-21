"use client";

import { Expand, Play } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { Modal } from "@/components/ui/Modal";
import { MetaBadges } from "@/features/catalog/MetaBadges";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { useMediaDetails } from "@/hooks/useMedia";
import type { Media, MediaDetails } from "@/types/media";
import { formatSeasons } from "@/utils/format";
import { MediaPlayer } from "./MediaPlayer";

interface MediaDetailModalProps {
  media: Media | null;
  autoplay?: boolean;
  onClose: () => void;
}

export function MediaDetailModal({ media, autoplay = false, onClose }: MediaDetailModalProps) {
  return (
    <Modal open={media !== null} onClose={onClose} label={media?.title ?? "Media details"}>
      {/* Keyed so playback state resets when another title opens. */}
      {media && <DetailContent key={media.id} media={media} autoplay={autoplay} onClose={onClose} />}
    </Modal>
  );
}

function DetailContent({ media, autoplay, onClose }: { media: Media; autoplay: boolean; onClose: () => void }) {
  const { details, isLoading } = useMediaDetails(media);
  const [playing, setPlaying] = useState(autoplay);
  const item: MediaDetails = details ?? media;
  const seasons = item.type === "tv" ? formatSeasons(item) : null;

  return (
    <article>
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {playing ? (
          <MediaPlayer media={item} isLoading={isLoading} />
        ) : (
          <>
            <MediaImage
              src={item.backdropUrl ?? item.posterUrl}
              alt=""
              sizes="(min-width: 896px) 896px, 100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-raised via-raised/20 to-transparent" />
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${item.title}`}
              className="glass absolute top-1/2 left-1/2 grid size-20 -translate-1/2 cursor-pointer place-items-center rounded-full text-white transition-all duration-300 hover:scale-110 hover:shadow-glow"
            >
              <Play className="ml-1 size-8 fill-current" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold sm:text-3xl">{item.title}</h2>
          {item.tagline && <p className="text-muted italic">{item.tagline}</p>}
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

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={() => setPlaying(true)} disabled={playing}>
            <Play className="size-5 fill-current" aria-hidden />
            {playing ? "Now playing" : "Play"}
          </Button>
          <ButtonLink href={`/watch/${media.id}`} variant="glass" size="lg" onClick={onClose}>
            <Expand className="size-5" aria-hidden />
            Open player
          </ButtonLink>
          <FavoriteButton media={media} withLabel />
        </div>
      </div>
    </article>
  );
}
