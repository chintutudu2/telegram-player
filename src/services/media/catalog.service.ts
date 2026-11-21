import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, SEARCH_RESULT_LIMIT } from "@/config/catalog";
import { isFirebaseWebConfigured } from "@/services/firebase/firebase.web";
import { libraryProvider } from "@/services/library/library.provider";
import { CATALOG_TAG } from "@/services/library/library.urls";
import type { Media, MediaDetails, MediaListKind, MediaScope, MediaType } from "@/types/media";

/**
 * Server-side catalog facade — the only module UI routes and API handlers
 * call. The Firestore `media` collection is the single source of truth:
 *   - Firebase not configured → callers render the "not configured" screen
 *     (see `app/(catalog)/layout.tsx`); API routes answer 503.
 *   - Configured but empty → views render the "no data" screen.
 * Results are cached and tagged `CATALOG_TAG`, which Telegram sync revalidates.
 */

export const isCatalogConfigured = isFirebaseWebConfigured;

export async function getMediaDetails(type: MediaType, id: string): Promise<MediaDetails | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  return libraryProvider.details(type, id);
}

export async function getMediaList(
  scope: MediaScope,
  kind: MediaListKind,
  { limit = 40 }: { limit?: number } = {},
): Promise<Media[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  return (await libraryProvider.list(scope, kind)).slice(0, limit);
}

/** Hero slides: newest titles that have artwork. */
export async function getFeatured(scope: MediaScope, count = 5): Promise<Media[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const trending = await getMediaList(scope, "trending");
  return trending.filter((item) => item.backdropUrl).slice(0, count);
}

export async function searchMedia(query: string, scope: MediaScope): Promise<Media[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const term = query.trim().slice(0, SEARCH_MAX_LENGTH);
  if (term.length < SEARCH_MIN_LENGTH) return [];
  return (await libraryProvider.search(term, scope)).slice(0, SEARCH_RESULT_LIMIT);
}
