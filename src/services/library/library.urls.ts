/**
 * Playback URL helpers (safe for server and client).
 *
 * NEXT_PUBLIC_STREAM_BASE_URL  — where `/<fileId>` is streamed from.
 *   Defaults to this app's proxy (`/api/stream`). Point it at an edge worker
 *   or self-hosted proxy to keep video bandwidth off your Next.js host.
 * NEXT_PUBLIC_PREVIEW_STREAM_URL — clip used when a record's
 *   `telegramFileId` is missing or a placeholder (e.g. "placeholder", "demo-1").
 */

const STREAM_BASE = (process.env.NEXT_PUBLIC_STREAM_BASE_URL || "/api/stream").replace(/\/+$/, "");

/** CC0 sample hosted by MDN. */
export const PREVIEW_STREAM_URL =
  process.env.NEXT_PUBLIC_PREVIEW_STREAM_URL ||
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const PLACEHOLDER_RE = /^(placeholder|sample|demo|test|todo|none|tbd)/i;
const FILE_ID_RE = /^[\w-]{10,256}$/;

export const isPlaceholderFileId = (fileId: string | null | undefined) =>
  !fileId || PLACEHOLDER_RE.test(fileId) || !FILE_ID_RE.test(fileId);

/** Proxied URL for any Telegram file (video or thumbnail). */
export const telegramFileUrl = (fileId: string) => `${STREAM_BASE}/${fileId}`;

/** Playable URL for a library video, falling back to the preview clip. */
export const streamUrlFor = (fileId: string | null | undefined) =>
  isPlaceholderFileId(fileId) ? PREVIEW_STREAM_URL : telegramFileUrl(fileId!);

/** Cache tag shared by every catalog read; revalidated after each sync. */
export const CATALOG_TAG = "catalog";
