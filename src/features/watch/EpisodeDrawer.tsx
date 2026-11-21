"use client";

import { ChevronDown, Play, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { useDismiss } from "@/hooks/useDismiss";
import type { MediaEpisode } from "@/types/media";
import { cn } from "@/utils/cn";
import { formatRuntime } from "@/utils/format";

export const seasonOf = (episode: MediaEpisode) => episode.season ?? 1;

interface EpisodeDrawerProps {
  open: boolean;
  onClose: () => void;
  episodes: MediaEpisode[];
  currentId: string;
  onSelect: (episode: MediaEpisode) => void;
}

/**
 * Slide-in episode picker: a season dropdown and that season's episodes.
 * Opens on the season that's playing; re-key it per episode to reset that.
 */
export function EpisodeDrawer({ open, onClose, episodes, currentId, onSelect }: EpisodeDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectId = useId();
  useDismiss(panelRef, onClose, open);

  const seasons = useMemo(() => Map.groupBy(episodes, seasonOf), [episodes]);
  const current = episodes.find((e) => e.id === currentId);
  const [season, setSeason] = useState(() => (current ? seasonOf(current) : (seasons.keys().next().value ?? 1)));
  const seasonEpisodes = seasons.get(season) ?? [];

  // On open: focus the panel and bring the playing episode into view.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current]");
    if (list && active) list.scrollTop = active.offsetTop - (list.clientHeight - active.offsetHeight) / 2;
  }, [open]);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 z-20 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        ref={panelRef}
        aria-label="Episodes"
        inert={!open}
        className={cn(
          "absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-white/10 bg-surface/95 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out sm:w-[26rem]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          <h2 className="text-xl font-semibold">Episodes</h2>
          <Button ref={closeRef} variant="ghost" size="icon" aria-label="Close episodes" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </header>

        <div className="px-5 pb-4">
          <label htmlFor={selectId} className="sr-only">
            Season
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={season}
              onChange={(event) => setSeason(Number(event.target.value))}
              className="glass h-11 w-full cursor-pointer appearance-none rounded-full pr-12 pl-5 text-[15px] font-medium text-fg outline-none transition-colors focus:border-accent/50"
            >
              {[...seasons.keys()].map((n) => (
                <option key={n} value={n} className="bg-raised">
                  Season {n}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted"
              aria-hidden
            />
          </div>
          <p className="mt-2 px-1 text-xs text-muted">
            {seasonEpisodes.length} {seasonEpisodes.length === 1 ? "episode" : "episodes"}
          </p>
        </div>

        <ol ref={listRef} className="no-scrollbar relative flex-1 space-y-1 overflow-y-auto px-3 pb-6">
          {seasonEpisodes.map((episode, i) => {
            const active = episode.id === currentId;
            return (
              <li key={episode.id}>
                <button
                  type="button"
                  onClick={() => onSelect(episode)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-2 text-left transition-colors",
                    active ? "border-accent/40 bg-accent/10" : "border-transparent hover:bg-white/5",
                  )}
                >
                  <span className={cn("w-6 shrink-0 text-center text-lg font-semibold", active ? "text-accent" : "text-muted")}>
                    {episode.episode ?? i + 1}
                  </span>
                  <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-black">
                    <MediaImage src={episode.thumbnailUrl} alt="" sizes="112px" />
                    {active && (
                      <span className="absolute inset-0 grid place-items-center bg-black/45">
                        <Play className="size-5 fill-white text-white" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium text-fg">{episode.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {active ? "Now playing" : episode.runtime ? formatRuntime(episode.runtime) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </>
  );
}
