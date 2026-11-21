import { Play } from "lucide-react";
import Link from "next/link";
import { MediaImage } from "@/components/ui/MediaImage";
import type { MediaEpisode } from "@/types/media";
import { cn } from "@/utils/cn";
import { formatRuntime } from "@/utils/format";

interface EpisodeListProps {
  mediaId: string;
  episodes: MediaEpisode[];
  currentId: string;
}

const episodeLabel = (e: MediaEpisode) =>
  [e.season && `S${e.season}`, e.episode && `E${e.episode}`].filter(Boolean).join(" · ");

export function EpisodeList({ mediaId, episodes, currentId }: EpisodeListProps) {
  const seasons = Map.groupBy(episodes, (e) => e.season ?? 1);

  return (
    <aside aria-label="Episodes" className="glass space-y-6 rounded-3xl p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-fg">Episodes</h2>
      {[...seasons].map(([season, items]) => (
        <section key={season} className="space-y-2">
          {seasons.size > 1 && <h3 className="px-1 text-sm font-medium text-muted">Season {season}</h3>}
          <ol className="space-y-2">
            {items.map((episode) => {
              const active = episode.id === currentId;
              return (
                <li key={episode.id}>
                  <Link
                    href={`/watch/${mediaId}?episode=${episode.id}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-2 transition-colors",
                      active ? "border-accent/40 bg-accent/10" : "border-transparent hover:bg-white/5",
                    )}
                  >
                    <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-black">
                      <MediaImage src={episode.thumbnailUrl} alt="" sizes="112px" />
                      {active && (
                        <span className="absolute inset-0 grid place-items-center bg-black/40">
                          <Play className="size-5 fill-white text-white" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      {episodeLabel(episode) && (
                        <span className="block text-xs font-medium text-accent">{episodeLabel(episode)}</span>
                      )}
                      <span className="block truncate text-sm text-fg">{episode.title}</span>
                      {episode.runtime && (
                        <span className="block text-xs text-muted">{formatRuntime(episode.runtime)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </aside>
  );
}
