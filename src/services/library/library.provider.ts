import "server-only";

import type { MediaProvider } from "@/services/media/media.provider";
import {
  type Media,
  type MediaDetails,
  type MediaEpisode,
  type MediaListKind,
  type MediaScope,
  toMediaId,
} from "@/types/media";
import { streamUrlFor } from "./library.urls";
import { filterByType, loadLibrary, seriesEpisodes } from "./media.repository";
import type { MediaRecord } from "./media.schema";

/**
 * Catalog provider over the Firestore `media` collection (Telegram uploads
 * or hand-entered docs). Everything derives from the cached library
 * snapshot. Movies map 1:1; series episodes group by `seriesKey`.
 */

const minutes = (seconds: number | null) => (seconds ? Math.round(seconds / 60) : undefined);

function baseMedia(record: MediaRecord, type: Media["type"], sourceId: string): Media {
  const genres = [record.category, ...(record.genres ?? [])].filter((g) => g && g !== "Uncategorized");
  return {
    id: toMediaId(type, sourceId),
    sourceId,
    source: "library",
    type,
    title: record.title,
    overview: record.overview ?? "",
    posterUrl: record.posterUrl ?? null,
    // A video frame still works as a wide backdrop (hero, player poster).
    backdropUrl: record.backdropUrl ?? record.thumbnailUrl,
    releaseYear: record.releaseYear,
    rating: record.rating ?? 0,
    voteCount: record.voteCount ?? 0,
    genres: [...new Set(genres)],
  };
}

const movieMedia = (record: MediaRecord): Media => ({
  ...baseMedia(record, "movie", record.id),
  runtime: minutes(record.durationSeconds),
});

/** `episodes` must be non-empty and share one `seriesKey`. */
function seriesMedia(episodes: MediaRecord[]): Media {
  // Prefer an episode carrying TMDB/hand-set artwork as the show's representative.
  const lead = episodes.find((e) => e.posterUrl) ?? episodes.find((e) => e.overview) ?? episodes[0];
  return {
    ...baseMedia(lead, "tv", lead.seriesKey!),
    seasons: new Set(episodes.map((e) => e.season ?? 1)).size,
    episodes: episodes.length,
  };
}

const toEpisode = (record: MediaRecord): MediaEpisode => ({
  id: record.id,
  title: record.episodeTitle ?? (record.episode ? `Episode ${record.episode}` : record.title),
  season: record.season,
  episode: record.episode,
  runtime: minutes(record.durationSeconds) ?? null,
  thumbnailUrl: record.thumbnailUrl,
  streamUrl: streamUrlFor(record.telegramFileId),
});

interface Entry {
  media: Media;
  /** Latest upload time, used for "trending" (newest) ordering. */
  updatedAt: number;
}

async function entries(scope: MediaScope): Promise<Entry[]> {
  const library = await loadLibrary();
  const result: Entry[] = [];

  if (scope !== "tv") {
    for (const record of filterByType(library, "movie")) {
      result.push({ media: movieMedia(record), updatedAt: record.createdAt });
    }
  }
  if (scope !== "movie") {
    const shows = Map.groupBy(filterByType(library, "series"), (r) => r.seriesKey!);
    for (const key of shows.keys()) {
      const episodes = seriesEpisodes(library, key);
      result.push({ media: seriesMedia(episodes), updatedAt: Math.max(...episodes.map((e) => e.createdAt)) });
    }
  }
  return result;
}

const sorters: Record<MediaListKind, (a: Entry, b: Entry) => number> = {
  trending: (a, b) => b.updatedAt - a.updatedAt,
  popular: (a, b) => b.media.voteCount - a.media.voteCount || b.updatedAt - a.updatedAt,
  top_rated: (a, b) => b.media.rating - a.media.rating || b.updatedAt - a.updatedAt,
};

export const libraryProvider: MediaProvider = {
  name: "library",

  async list(scope, kind) {
    return (await entries(scope)).sort(sorters[kind]).map((e) => e.media);
  },

  async search(query, scope) {
    const needle = query.toLowerCase();
    return (await entries(scope))
      .sort(sorters.trending)
      .map((e) => e.media)
      .filter((m) => [m.title, ...m.genres].some((field) => field.toLowerCase().includes(needle)));
  },

  async details(type, id): Promise<MediaDetails | null> {
    const library = await loadLibrary();

    if (type === "movie") {
      const record = library.find((r) => r.id === id && r.type === "movie");
      return record ? { ...movieMedia(record), streamUrl: streamUrlFor(record.telegramFileId) } : null;
    }

    const episodes = seriesEpisodes(library, id);
    if (episodes.length === 0) return null;
    const episodeList = episodes.map(toEpisode);
    return { ...seriesMedia(episodes), episodeList, streamUrl: episodeList[0].streamUrl };
  },
};
