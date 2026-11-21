import "server-only";

import type { MediaProvider } from "@/services/media/media.provider";
import type { Media, MediaListKind, MediaScope, MediaType } from "@/types/media";
import { interleave } from "@/utils/collections";
import { tmdbFetch } from "./tmdb.client";
import { fromMultiResults, toMedia, toMediaDetails } from "./tmdb.mappers";
import type { TmdbDetails, TmdbItem, TmdbMultiItem, TmdbPage } from "./tmdb.types";

const LIST_PATHS: Record<Exclude<MediaListKind, "trending">, Record<MediaType, string>> = {
  popular: { movie: "/movie/popular", tv: "/tv/popular" },
  top_rated: { movie: "/movie/top_rated", tv: "/tv/top_rated" },
};

async function fetchTyped(path: string, type: MediaType, params = {}): Promise<Media[]> {
  const page = await tmdbFetch<TmdbPage<TmdbItem>>(path, params);
  return page.results.map((item) => toMedia(item, type));
}

/** Runs a per-type fetcher for one scope, merging both types for `all`. */
async function forScope(
  scope: MediaScope,
  fetcher: (type: MediaType) => Promise<Media[]>,
): Promise<Media[]> {
  if (scope !== "all") return fetcher(scope);
  const [movies, shows] = await Promise.all([fetcher("movie"), fetcher("tv")]);
  return interleave(movies, shows);
}

export const tmdbProvider: MediaProvider = {
  name: "tmdb",

  async list(scope, kind) {
    if (kind === "trending") {
      const page = await tmdbFetch<TmdbPage<TmdbMultiItem>>(`/trending/${scope}/week`);
      return fromMultiResults(
        page.results.map((item) =>
          // `/trending/movie|tv` omits media_type; restore it for the mapper.
          scope === "all" ? item : ({ ...item, media_type: scope } as TmdbMultiItem),
        ),
      );
    }
    return forScope(scope, (type) => fetchTyped(LIST_PATHS[kind][type], type));
  },

  async search(query, scope) {
    if (scope === "all") {
      const page = await tmdbFetch<TmdbPage<TmdbMultiItem>>("/search/multi", {
        query,
        include_adult: "false",
      });
      return fromMultiResults(page.results);
    }
    return fetchTyped(`/search/${scope}`, scope, { query, include_adult: "false" });
  },

  async details(type, id) {
    const item = await tmdbFetch<TmdbDetails>(`/${type}/${id}`, {
      append_to_response: "videos",
    });
    return toMediaDetails(item, type);
  },
};
