import { normalizeCategory } from "@/config/categories";

/**
 * TMDB genre ids are stable, so they are resolved locally instead of
 * spending two extra API calls (`/genre/movie/list`, `/genre/tv/list`).
 */
const GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  // TV-specific
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

/**
 * TV uses combined genres; splitting them lets one genre filter work
 * uniformly across movies and series.
 */
const COMBINED: Record<string, string[]> = {
  "Action & Adventure": ["Action", "Adventure"],
  "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
  "War & Politics": ["War", "Politics"],
};

export function normalizeGenres(names: readonly string[]): string[] {
  return [...new Set(names.flatMap((name) => COMBINED[name] ?? [name]).map(normalizeCategory))];
}

export function genreNames(ids: readonly number[] = []): string[] {
  return normalizeGenres(ids.flatMap((id) => (GENRES[id] ? [GENRES[id]] : [])));
}
