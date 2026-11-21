import { type Media, type MediaDetails, type MediaSource, type MediaType, toMediaId } from "@/types/media";
import { tmdbImageUrl } from "./tmdb.client";
import { genreNames, normalizeGenres } from "./tmdb.genres";
import type { TmdbDetails, TmdbItem, TmdbMultiItem, TmdbVideo } from "./tmdb.types";

const isMovie = (item: TmdbItem): item is Extract<TmdbItem, { title: string }> =>
  "title" in item;

function yearOf(date?: string): number | null {
  const year = date ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) ? year : null;
}

export function toMedia(item: TmdbItem, type: MediaType, source: MediaSource = "tmdb"): Media {
  const movie = isMovie(item) ? item : null;
  const show = isMovie(item) ? null : item;

  return {
    id: toMediaId(type, String(item.id)),
    sourceId: String(item.id),
    source,
    type,
    title: movie?.title ?? show?.name ?? "Untitled",
    overview: item.overview,
    posterUrl: tmdbImageUrl(item.poster_path, "w500"),
    backdropUrl: tmdbImageUrl(item.backdrop_path, "w1280"),
    releaseYear: yearOf(movie?.release_date ?? show?.first_air_date),
    rating: Math.round(item.vote_average * 10) / 10,
    voteCount: item.vote_count,
    genres: item.genres ? normalizeGenres(item.genres.map((g) => g.name)) : genreNames(item.genre_ids),
    runtime: movie?.runtime ?? undefined,
    seasons: show?.number_of_seasons,
    episodes: show?.number_of_episodes,
  };
}

/** Maps `/trending/all` & `/search/multi` results, dropping people. */
export function fromMultiResults(items: TmdbMultiItem[]): Media[] {
  return items.flatMap((item) =>
    item.media_type === "movie" || item.media_type === "tv"
      ? [toMedia(item as TmdbItem, item.media_type)]
      : [],
  );
}

function pickTrailer(videos: TmdbVideo[] = []): string | undefined {
  const youtube = videos.filter((v) => v.site === "YouTube");
  const best =
    youtube.find((v) => v.type === "Trailer" && v.official) ??
    youtube.find((v) => v.type === "Trailer") ??
    youtube.find((v) => v.type === "Teaser");
  return best?.key;
}

export function toMediaDetails(
  item: TmdbDetails,
  type: MediaType,
  source: MediaSource = "tmdb",
): MediaDetails {
  return {
    ...toMedia(item, type, source),
    tagline: item.tagline || undefined,
    trailerKey: pickTrailer(item.videos?.results),
  };
}
