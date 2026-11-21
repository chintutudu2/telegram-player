"use client";

import { SEARCH_MIN_LENGTH } from "@/config/catalog";
import { mediaApi } from "@/services/media/media.api";
import type { Media, MediaDetails, MediaScope } from "@/types/media";
import { useApiQuery } from "./useApiQuery";
import { useDebounce } from "./useDebounce";

/** Debounced live search across the active catalog scope. */
export function useMediaSearch(query: string, scope: MediaScope) {
  const term = useDebounce(query.trim(), 300);
  const enabled = term.length >= SEARCH_MIN_LENGTH;
  const result = useApiQuery<Media[]>(enabled ? mediaApi.searchUrl(term, scope) : null);

  return {
    ...result,
    results: result.data ?? [],
    /** True while the user is typing or the request is in flight. */
    isPending: enabled && (result.isLoading || term !== query.trim()),
    isActive: query.trim().length >= SEARCH_MIN_LENGTH,
  };
}

/** Lazily loads full details (trailer, runtime…) on top of a list item. */
export function useMediaDetails(media: Media | null) {
  const { data, isLoading, error } = useApiQuery<MediaDetails>(
    media ? mediaApi.detailsUrl(media) : null,
  );
  const details: MediaDetails | null = media ? { ...media, ...data } : null;
  return { details, isLoading, error };
}
