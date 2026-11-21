import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "@/services/library/library.urls";
import { findByFileId, loadLibrary } from "@/services/library/media.repository";
import { jsonError } from "@/utils/route";
import { isMtprotoConfigured } from "./mtproto.client";
import { streamVideoFromTelegram } from "./mtproto.stream";
import { TelegramApiError, telegramApi } from "./telegram.client";
import type { TelegramConfig } from "./telegram.config";
import type { TelegramFile } from "./telegram.types";

/**
 * Streams Telegram-hosted files to the browser without exposing the bot's
 * credentials. Telegram stays the only storage; nothing is written to disk.
 *
 *   - Videos: MTProto (any size, byte ranges with read-ahead) when
 *     TELEGRAM_API_ID/HASH are set.
 *   - Thumbnails, or videos without MTProto: Bot API download (20 MB cap).
 */

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Only files referenced by the library may be streamed (no open proxy). */
async function getStreamAsset(fileId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  // Served from the cached library snapshot: no extra Firestore reads.
  const match = findByFileId(await loadLibrary(), fileId);
  if (!match) return null;
  const { chatId, messageId } = match.record.telegram;
  return {
    kind: match.kind,
    mimeType: match.kind === "video" ? match.record.mimeType : null,
    message: chatId && messageId ? { chatId, messageId } : null,
  };
}

// Telegram guarantees Bot API download links for at least an hour.
const FILE_TTL_MS = 30 * 60 * 1000;
const fileCache = new Map<string, { file: TelegramFile; expires: number }>();

async function resolveFile(config: TelegramConfig, fileId: string, fresh = false): Promise<TelegramFile> {
  const cached = fileCache.get(fileId);
  if (!fresh && cached && cached.expires > Date.now()) return cached.file;

  const file = await telegramApi.getFile(config, fileId);
  if (fileCache.size > 500) fileCache.clear();
  fileCache.set(fileId, { file, expires: Date.now() + FILE_TTL_MS });
  return file;
}

function contentTypeFor(filePath: string, known: string | null | undefined): string {
  if (known) return known;
  return MIME_BY_EXT[filePath.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** Bot API: proxy the HTTPS download, forwarding the Range header. */
async function proxyBotApiFile(url: string, request: Request, contentType: string): Promise<Response | null> {
  const range = request.headers.get("range");
  const upstream = await fetch(url, {
    headers: range ? { Range: range } : undefined,
    signal: request.signal,
  });

  if (upstream.status === 404) return null; // expired path → caller re-resolves
  if (upstream.status === 416) {
    return new Response(null, { status: 416, headers: { "Content-Range": upstream.headers.get("content-range") ?? "" } });
  }
  if (!upstream.ok || !upstream.body) return jsonError(502, `Telegram file server returned ${upstream.status}.`);

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "X-Stream-Source": "bot-api",
  });
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(
    "Accept-Ranges",
    upstream.headers.get("accept-ranges") ?? (upstream.status === 206 ? "bytes" : "none"),
  );
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function streamViaBotApi(config: TelegramConfig, fileId: string, request: Request, mimeType: string | null) {
  try {
    for (const fresh of [false, true]) {
      const file = await resolveFile(config, fileId, fresh);
      if (!file.file_path) return jsonError(502, "Telegram did not return a file path.");

      const response = await proxyBotApiFile(
        telegramApi.fileUrl(config, file.file_path),
        request,
        contentTypeFor(file.file_path, mimeType),
      );
      if (response) return response;
      fileCache.delete(fileId); // stale link: retry once with a fresh getFile
    }
    return jsonError(502, "Telegram file link expired.");
  } catch (error) {
    if (error instanceof TelegramApiError && /too big/i.test(error.message)) {
      return jsonError(
        413,
        "This video is larger than 20 MB. Add TELEGRAM_API_ID and TELEGRAM_API_HASH (from my.telegram.org) to stream full-length files.",
      );
    }
    throw error;
  }
}

export async function streamTelegramFile(config: TelegramConfig, fileId: string, request: Request): Promise<Response> {
  const asset = await getStreamAsset(fileId);
  if (!asset) return jsonError(404, "Unknown media file.");

  if (asset.kind === "video" && asset.message && isMtprotoConfigured()) {
    return streamVideoFromTelegram(asset.message, request, asset.mimeType);
  }
  return streamViaBotApi(config, fileId, request, asset.mimeType);
}
