import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/services/firebase/firebase.admin";
import {
  type LibraryType,
  MEDIA_COLLECTION,
  type MediaDocument,
  type SubtitleDocument,
  SYSTEM_COLLECTION,
  type TmdbEnrichment,
  tmdbLookupKey,
} from "./media.schema";

/** Write side of the library (Admin SDK) — used only by Telegram sync. */

const media = () => getAdminDb().collection(MEDIA_COLLECTION);

/** Idempotent create-or-update keyed by Telegram `file_unique_id`. */
export async function upsertMediaRecord(id: string, { createdAt, ...fields }: MediaDocument): Promise<void> {
  await media()
    .doc(id)
    .set(
      { ...fields, createdAt: Timestamp.fromMillis(createdAt), updatedAt: Timestamp.now() },
      { merge: true },
    );
}

const subtitlesOf = (value: unknown): SubtitleDocument[] => (Array.isArray(value) ? value : []);

/**
 * When a channel post's file is replaced (edit → replace file), Telegram
 * gives it a new file id, so remove the entry for the old file. Its
 * subtitles still reply to the same post, so they move to the new entry.
 */
export async function removeReplacedMedia(chatId: number, messageId: number, keepId: string): Promise<number> {
  const snapshot = await media()
    .where("telegram.chatId", "==", chatId)
    .where("telegram.messageId", "==", messageId)
    .get();
  const stale = snapshot.docs.filter((doc) => doc.id !== keepId);
  const carried = stale.flatMap((doc) => subtitlesOf(doc.get("subtitles")));
  if (carried.length) await media().doc(keepId).update({ subtitles: FieldValue.arrayUnion(...carried) });
  await Promise.all(stale.map((doc) => doc.ref.delete()));
  return stale.length;
}

/**
 * Adds a subtitle to a video's entry, replacing any earlier file from the
 * same reply (its file was swapped). Returns the video's title, or null if
 * the video isn't in the library.
 */
export async function attachSubtitle(videoId: string, subtitle: SubtitleDocument): Promise<string | null> {
  const ref = media().doc(videoId);
  return getAdminDb().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    const others = subtitlesOf(doc.get("subtitles")).filter((s) => s.messageId !== subtitle.messageId);
    tx.update(ref, { subtitles: [...others, subtitle], updatedAt: Timestamp.now() });
    return String(doc.get("title") ?? videoId);
  });
}

/** Removes subtitles whose reply posts were deleted. */
export async function detachSubtitles(videoId: string, messageIds: number[]): Promise<void> {
  const ref = media().doc(videoId);
  await getAdminDb().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return;
    const kept = subtitlesOf(doc.get("subtitles")).filter((s) => !messageIds.includes(s.messageId));
    tx.update(ref, { subtitles: kept });
  });
}

export interface TelegramMediaRef {
  id: string;
  title: string;
  chatId: number;
  messageId: number;
  subtitles: { label: string; messageId: number }[];
}

/** Documents that came from a Telegram post (hand-entered ones are skipped). */
export async function listTelegramMedia(): Promise<TelegramMediaRef[]> {
  const snapshot = await media().get();
  return snapshot.docs.flatMap((doc) => {
    const { title, telegram, subtitles } = doc.data();
    return telegram?.chatId && telegram?.messageId
      ? [
          {
            id: doc.id,
            title: String(title ?? doc.id),
            chatId: telegram.chatId,
            messageId: telegram.messageId,
            subtitles: subtitlesOf(subtitles).map(({ label, messageId }) => ({ label, messageId })),
          },
        ]
      : [];
  });
}

export async function deleteMedia(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => media().doc(id).delete()));
}

export async function setTmdbEnrichment(id: string, tmdb: TmdbEnrichment): Promise<void> {
  await media().doc(id).set({ tmdb }, { merge: true });
}

export interface EnrichmentCandidate {
  id: string;
  title: string;
  type: LibraryType;
  releaseYear: number | null;
  lookup: string;
}

/** Documents whose TMDB data is missing or stale (title/year edited). */
export async function listEnrichmentCandidates(): Promise<EnrichmentCandidate[]> {
  const snapshot = await media().get();
  return snapshot.docs.flatMap((doc) => {
    const data = doc.data();
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title) return [];
    const type: LibraryType = /^(series|tv|show)$/i.test(String(data.type ?? "")) ? "series" : "movie";
    const releaseYear = typeof data.releaseYear === "number" ? data.releaseYear : null;
    const lookup = tmdbLookupKey(title, type, releaseYear);
    return data.tmdb?.lookup === lookup ? [] : [{ id: doc.id, title, type, releaseYear, lookup }];
  });
}

// --- Sync bookkeeping -------------------------------------------------------

const telegramState = () => getAdminDb().collection(SYSTEM_COLLECTION).doc("telegram");

export async function getUpdateOffset(): Promise<number | undefined> {
  const value = (await telegramState().get()).get("nextUpdateId");
  return typeof value === "number" ? value : undefined;
}

export async function setUpdateOffset(nextUpdateId: number): Promise<void> {
  await telegramState().set({ nextUpdateId, syncedAt: Timestamp.now() }, { merge: true });
}
