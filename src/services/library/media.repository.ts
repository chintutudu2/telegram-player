import "server-only";

import { collection, type DocumentData, getDocs } from "firebase/firestore/lite";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeCategory, splitCategories } from "@/config/categories";
import { getCatalogDb, isFirebaseWebConfigured } from "@/services/firebase/firebase.web";
import { parseDuration, slugify } from "@/services/telegram/caption.parser";
import { CATALOG_TAG } from "./library.urls";
import { type LibraryType, MEDIA_COLLECTION, type MediaRecord, type SubtitleDocument } from "./media.schema";

/**
 * Read side of the Firestore `media` collection (Firebase Web SDK).
 *
 * Cost model: the whole collection is fetched in ONE cached query and every
 * list/filter/search/detail is derived in memory. Firestore is read at most
 * once per cache window (and after each Telegram sync), independent of
 * traffic — comfortably inside the free tier for channel-sized libraries.
 */

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function millis(value: unknown): number {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "string") return Date.parse(value) || 0;
  return num(value) ?? 0;
}

function libraryType(value: unknown): LibraryType {
  return /^(series|tv|show)$/i.test(str(value)) ? "series" : "movie";
}

const genreList = (value: unknown) =>
  Array.isArray(value) ? value.filter((g): g is string => typeof g === "string").map(normalizeCategory) : undefined;

const subtitleList = (value: unknown): SubtitleDocument[] =>
  Array.isArray(value)
    ? value.flatMap((s: DocumentData) =>
        str(s?.fileId)
          ? [
              {
                fileId: str(s.fileId),
                fileUniqueId: str(s.fileUniqueId),
                label: str(s.label) || "Subtitles",
                lang: str(s.lang) || null,
                messageId: num(s.messageId) ?? 0,
              },
            ]
          : [],
      )
    : [];

/**
 * Lenient mapping so documents added by hand in the Firebase console work
 * with just the core fields (title, type, category, duration, rating,
 * thumbnailUrl, telegramFileId, createdAt).
 *
 * Display fields resolve as: values set on the document → TMDB enrichment
 * (`tmdb`). A hand-entered `thumbnailUrl` counts as a deliberate poster and
 * beats TMDB; Telegram's auto-thumbnail (a random video frame) is never
 * used as a poster — cards render a typographic poster instead.
 */
function toRecord(id: string, data: DocumentData): MediaRecord | null {
  const title = str(data.title);
  if (!title) return null;

  const type = libraryType(data.type);
  const duration = str(data.duration);
  const durationSeconds = num(data.durationSeconds) ?? (duration ? parseDuration(duration) : null);
  const createdAt = millis(data.createdAt);

  const tmdb: DocumentData = data.tmdb?.found ? data.tmdb : {};
  // `category` may list several ("Comedy, Adventure"): first is the primary.
  const categories = splitCategories(str(data.category));
  const otherGenres = genreList(data.genres) ?? genreList(tmdb.genres) ?? [];
  const thumbnailUrl = str(data.thumbnailUrl) || null;
  const autoThumbnail = Boolean(str(data.thumbnailFileId)); // low-res frame from Telegram
  const tmdbPoster = str(tmdb.posterUrl) || null;

  return {
    id,
    title,
    type,
    category: categories[0] ?? "Uncategorized",
    telegramFileId: str(data.telegramFileId),
    duration,
    thumbnailUrl,
    createdAt,
    updatedAt: millis(data.updatedAt) || createdAt,
    durationSeconds,
    mimeType: str(data.mimeType) || null,
    fileSize: num(data.fileSize),
    thumbnailFileId: str(data.thumbnailFileId) || null,
    releaseYear: num(data.releaseYear) ?? num(tmdb.releaseYear),
    seriesKey: type === "series" ? str(data.seriesKey) || slugify(title) : null,
    season: num(data.season),
    episode: num(data.episode),
    episodeTitle: str(data.episodeTitle) || null,
    telegram: data.telegram ?? { chatId: 0, messageId: 0 },
    overview: str(data.overview) || str(tmdb.overview) || undefined,
    posterUrl: str(data.posterUrl) || (autoThumbnail ? tmdbPoster : thumbnailUrl || tmdbPoster) || null,
    backdropUrl: str(data.backdropUrl) || str(tmdb.backdropUrl) || null,
    rating: num(data.rating) ?? num(tmdb.rating) ?? undefined,
    voteCount: num(data.voteCount) ?? num(tmdb.voteCount) ?? undefined,
    genres: [...new Set([...categories.slice(1), ...otherGenres])],
    subtitles: subtitleList(data.subtitles),
  };
}

const mediaCollection = () => collection(getCatalogDb(), MEDIA_COLLECTION);

/** Every valid `media` document, newest first. Cached; one query per window. */
export async function loadLibrary(): Promise<MediaRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  // Unconfigured: the (catalog) layout shows the setup screen, but Next.js
  // still renders the page segment, so reads must be safe no-ops.
  if (!isFirebaseWebConfigured()) return [];

  const snapshot = await getDocs(mediaCollection());
  return snapshot.docs
    .flatMap((doc) => toRecord(doc.id, doc.data()) ?? [])
    .sort((a, b) => b.createdAt - a.createdAt);
}

// --- In-memory selectors over `loadLibrary()` -----------------------------

export const filterByType = (records: MediaRecord[], type: LibraryType) =>
  records.filter((r) => r.type === type);

export const filterByCategory = (records: MediaRecord[], category: string) => {
  const name = normalizeCategory(category);
  return records.filter((r) => r.category === name || r.genres?.includes(name));
};

/** Episodes of one series, ordered by season → episode → upload time. */
export const seriesEpisodes = (records: MediaRecord[], seriesKey: string) =>
  records
    .filter((r) => r.type === "series" && r.seriesKey === seriesKey)
    .sort(
      (a, b) =>
        (a.season ?? 0) - (b.season ?? 0) ||
        (a.episode ?? 0) - (b.episode ?? 0) ||
        a.createdAt - b.createdAt,
    );

/** Which library file (video or thumbnail) a Telegram file id belongs to. */
export function findByFileId(records: MediaRecord[], fileId: string) {
  for (const record of records) {
    if (record.telegramFileId === fileId) return { record, kind: "video" as const };
    if (record.thumbnailFileId === fileId) return { record, kind: "thumbnail" as const };
  }
  return null;
}

/** The library subtitle with this Telegram file id, if any. */
export function findSubtitle(records: MediaRecord[], fileId: string): SubtitleDocument | null {
  for (const record of records) {
    const match = record.subtitles.find((s) => s.fileId === fileId);
    if (match) return match;
  }
  return null;
}
