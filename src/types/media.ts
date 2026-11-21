/**
 * Provider-agnostic domain model. Every data source (Firestore library,
 * TMDB enrichment…) is normalized into these shapes so UI code never touches
 * raw API payloads or Firestore documents.
 */

// Runtime tuples double as validation lists for API input parsing.
export const MEDIA_TYPES = ["movie", "tv"] as const;
export const MEDIA_SCOPES = ["all", ...MEDIA_TYPES] as const;
export const MEDIA_LIST_KINDS = ["trending", "popular", "top_rated"] as const;
/** `library` = the Firestore catalog; `tmdb` = metadata used to enrich uploads. */
export const MEDIA_SOURCES = ["library", "tmdb"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];
/** A catalog scope: a single media type or both combined. */
export type MediaScope = (typeof MEDIA_SCOPES)[number];
export type MediaListKind = (typeof MEDIA_LIST_KINDS)[number];
export type MediaSource = (typeof MEDIA_SOURCES)[number];

export interface Media {
  /** Globally unique key, `${type}-${sourceId}`. Safe for React keys and URLs. */
  id: string;
  /** Identifier inside the originating provider (TMDB id, Firestore doc id…). */
  sourceId: string;
  source: MediaSource;
  type: MediaType;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseYear: number | null;
  /** 0–10 scale; 0 when unrated. */
  rating: number;
  voteCount: number;
  genres: string[];
  /** Minutes. Movies only, present when details are known. */
  runtime?: number;
  /** TV only, present when details are known. */
  seasons?: number;
  episodes?: number;
}

/** A single playable episode of a library series. */
export interface MediaEpisode {
  id: string;
  title: string;
  season: number | null;
  episode: number | null;
  /** Minutes, when known. */
  runtime: number | null;
  thumbnailUrl: string | null;
  streamUrl: string;
}

export interface MediaDetails extends Media {
  tagline?: string;
  /** YouTube video key for the official trailer, when available. */
  trailerKey?: string;
  /** Direct playable URL (the Telegram stream proxy for library items). */
  streamUrl?: string;
  /** Library series only, ordered by season then episode. */
  episodeList?: MediaEpisode[];
}

export const toMediaId = (type: MediaType, sourceId: string) => `${type}-${sourceId}`;

/** Inverse of `toMediaId`; `null` for malformed ids. */
export function parseMediaId(id: string): { type: MediaType; sourceId: string } | null {
  const match = /^(movie|tv)-([\w-]{1,128})$/.exec(id);
  return match ? { type: match[1] as MediaType, sourceId: match[2] } : null;
}
