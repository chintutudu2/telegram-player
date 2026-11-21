import type { Media } from "@/types/media";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 12500 → "12.5K" */
export const formatCompact = (value: number) => compact.format(value);

/** 7.84 → "7.8" */
export const formatRating = (rating: number) => rating.toFixed(1);

/** 169 → "2h 49min", 45 → "45min" */
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}min`].filter(Boolean).join(" ");
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "3 Seasons · 24 Episodes" — omits whichever part is unknown. */
export function formatSeasons({ seasons, episodes }: Pick<Media, "seasons" | "episodes">): string | null {
  const parts = [seasons && plural(seasons, "Season"), episodes && plural(episodes, "Episode")];
  return parts.filter(Boolean).join(" · ") || null;
}

/** Duration label for any media: runtime for films, seasons for series. */
export function formatDuration(media: Media): string | null {
  if (media.type === "movie") return media.runtime ? formatRuntime(media.runtime) : null;
  return media.seasons ? plural(media.seasons, "Season") : null;
}

export const mediaTypeLabel = (media: Pick<Media, "type">) =>
  media.type === "movie" ? "Movie" : "Series";
