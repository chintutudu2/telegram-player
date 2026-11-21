import type { Media, MediaScope } from "@/types/media";

/**
 * Browser-side endpoints. Components never query Firestore directly; they
 * go through the cached `/api/media` route handlers.
 */
export const mediaApi = {
  searchUrl: (query: string, scope: MediaScope) =>
    `/api/media?${new URLSearchParams({ query, scope })}`,

  detailsUrl: ({ type, sourceId }: Pick<Media, "type" | "sourceId">) => `/api/media/${type}/${sourceId}`,
};
