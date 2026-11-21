/** Raw TMDB v3 payload shapes (only the fields this app consumes). */

interface TmdbBaseItem {
  id: number;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  /** Present on detail responses instead of `genre_ids`. */
  genres?: { id: number; name: string }[];
  original_language?: string;
}

export interface TmdbMovie extends TmdbBaseItem {
  media_type?: "movie";
  title: string;
  original_title?: string;
  release_date?: string;
  runtime?: number | null;
  tagline?: string;
}

export interface TmdbTvShow extends TmdbBaseItem {
  media_type?: "tv";
  name: string;
  original_name?: string;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  tagline?: string;
}

export type TmdbItem = TmdbMovie | TmdbTvShow;

/** `/trending/all` and `/search/multi` can also return people. */
export type TmdbMultiItem = TmdbItem | { media_type: "person"; id: number };

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

export type TmdbDetails = TmdbItem & {
  videos?: { results: TmdbVideo[] };
};

export interface TmdbPage<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}
