/**
 * Firestore `media` collection — one document per uploaded Telegram video.
 * Document id = Telegram `file_unique_id`, so re-syncing or editing a
 * caption updates the same document instead of duplicating it.
 */

export const MEDIA_COLLECTION = "media";
/** Bookkeeping documents (e.g. the `getUpdates` offset). */
export const SYSTEM_COLLECTION = "system";

export const LIBRARY_TYPES = ["movie", "series"] as const;
export type LibraryType = (typeof LIBRARY_TYPES)[number];

/**
 * TMDB metadata, stored under `tmdb` so it never overwrites values typed
 * by hand (explicit `posterUrl`, `overview`, `rating`… always win).
 */
export interface TmdbEnrichment {
  /** Which title/year this answers; a changed title triggers a re-lookup. */
  lookup: string;
  found: boolean;
  tmdbId?: number;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: number;
  voteCount?: number;
  genres?: string[];
  releaseYear?: number | null;
}

export const tmdbLookupKey = (title: string, type: LibraryType, year: number | null) =>
  `${type}:${title.trim().toLowerCase()}:${year ?? ""}`;

/** Shape written by ingestion (timestamps as epoch ms; converted on write). */
export interface MediaDocument {
  title: string;
  type: LibraryType;
  category: string;
  telegramFileId: string;
  /** Human readable, e.g. "2h 15m". */
  duration: string;
  /** Proxied through the stream endpoint; never a raw Telegram URL. */
  thumbnailUrl: string | null;
  createdAt: number;
  durationSeconds: number | null;
  mimeType: string | null;
  fileSize: number | null;
  thumbnailFileId: string | null;
  /** From the caption, e.g. "Title (2010)". */
  releaseYear: number | null;
  /** Series grouping: slug of the title. `null` for movies. */
  seriesKey: string | null;
  season: number | null;
  episode: number | null;
  episodeTitle: string | null;
  telegram: { chatId: number; messageId: number };
  tmdb?: TmdbEnrichment;
}

/** Read model: explicit fields resolved against TMDB fallbacks. */
export interface MediaRecord extends Omit<MediaDocument, "tmdb"> {
  id: string;
  updatedAt: number;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: number;
  voteCount?: number;
  genres?: string[];
}
