import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/feedback";
import { MetaBadges } from "@/features/catalog/MetaBadges";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { MediaPlayer } from "@/features/media-detail/MediaPlayer";
import { getMediaDetails } from "@/services/media/catalog.service";
import { parseMediaId } from "@/types/media";
import { EpisodeList } from "./EpisodeList";

/** Resolves a `/watch/[id]` param to full details, or 404s. */
export async function loadWatchDetails(id: string) {
  const ref = parseMediaId(id);
  const details = ref && (await getMediaDetails(ref.type, ref.sourceId));
  if (!details) notFound();
  return details;
}

interface WatchViewProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function WatchView({ params, searchParams }: WatchViewProps) {
  const { id } = await params;
  const { episode: episodeParam } = await searchParams;
  const details = await loadWatchDetails(id);

  const episodes = details.episodeList ?? [];
  const current = episodes.find((e) => e.id === episodeParam) ?? episodes[0];
  const playable = current ? { ...details, streamUrl: current.streamUrl } : details;
  const backHref = details.type === "movie" ? "/movies" : "/series";

  return (
    <article className="space-y-6">
      <ButtonLink href={backHref} variant="ghost" size="sm" className="-ml-3">
        <ArrowLeft className="size-4" aria-hidden />
        Back to {details.type === "movie" ? "Movies" : "Series"}
      </ButtonLink>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
            <MediaPlayer key={playable.streamUrl ?? id} media={playable} className="h-full w-full rounded-2xl shadow-2xl" />
          </div>

          <header className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-semibold text-fg sm:text-3xl">{details.title}</h1>
                {current && (
                  <p className="text-accent">
                    {[current.season && `Season ${current.season}`, current.episode && `Episode ${current.episode}`, current.title]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <FavoriteButton media={details} withLabel />
            </div>
            <MetaBadges media={details} fields={["type", "year", "duration", "rating", "votes"]} />
            {details.genres.length > 0 && (
              <p className="text-sm text-muted">{details.genres.join(" · ")}</p>
            )}
            {details.overview && <p className="max-w-3xl leading-relaxed text-fg/85">{details.overview}</p>}
          </header>
        </div>

        {current && <EpisodeList mediaId={id} episodes={episodes} currentId={current.id} />}
      </div>
    </article>
  );
}

export function WatchSkeleton() {
  return (
    <div role="status" aria-label="Loading player" className="space-y-6">
      <Skeleton className="h-9 w-40 rounded-full" />
      <Skeleton className="aspect-video rounded-2xl" />
      <Skeleton className="h-8 w-2/3 max-w-md rounded-full" />
      <Skeleton className="h-20 max-w-3xl" />
    </div>
  );
}
