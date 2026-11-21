import "server-only";

import bigInt from "big-integer";
import { Api, errors, type TelegramClient } from "telegram";
import { parseRange } from "@/utils/range";
import { jsonError } from "@/utils/route";
import { createChunkedStream } from "./chunked-range";
import { getBotPool, markUnusable, pickBot, type StreamBot } from "./mtproto.client";

/**
 * Streams a video straight from Telegram over MTProto: only the requested
 * byte range is downloaded (with read-ahead) and passed to the browser.
 * Nothing is written to disk.
 *
 * Each viewer is served by the least-busy bot in the pool. If Telegram
 * rate-limits that bot mid-stream, the viewer moves to another bot.
 */

/** Telegram's per-request cap is 1 MB; 512 KB keeps every request aligned. */
const CHUNK_SIZE = 512 * 1024;
const READ_AHEAD_MB = Number(process.env.TELEGRAM_STREAM_READAHEAD_MB) || 8;
// 2 in flight is nearly as fast as 4 (measured ~2.5 MB/s per bot) with half
// the request rate, which keeps Telegram's flood limits at bay.
const CONCURRENCY = Number(process.env.TELEGRAM_STREAM_PARALLEL) || 2;

/** Where the video lives: the channel message it was posted in. */
export interface VideoMessageRef {
  chatId: number;
  messageId: number;
}

interface VideoFile {
  location: Api.InputDocumentFileLocation;
  dcId: number;
  size: number;
  mimeType: string;
}

// --- Per-bot file lookup ------------------------------------------------------

// File references are per bot and expire; refetch periodically and on error.
const FILE_TTL_MS = 30 * 60 * 1000;
const files = new Map<string, { file: VideoFile | null; expires: number }>();

async function resolveVideo(bot: StreamBot, client: TelegramClient, ref: VideoMessageRef, fresh = false) {
  const key = `${bot.number}:${ref.chatId}:${ref.messageId}`;
  const cached = files.get(key);
  if (!fresh && cached && cached.expires > Date.now()) return cached.file;

  const [message] = await client.getMessages(ref.chatId, { ids: ref.messageId });
  const document = message?.media instanceof Api.MessageMediaDocument ? message.media.document : undefined;
  const file: VideoFile | null =
    document instanceof Api.Document
      ? {
          location: new Api.InputDocumentFileLocation({
            id: document.id,
            accessHash: document.accessHash,
            fileReference: document.fileReference,
            thumbSize: "",
          }),
          dcId: document.dcId,
          size: document.size.toJSNumber(),
          mimeType: document.mimeType,
        }
      : null;

  if (files.size > 1000) files.clear();
  files.set(key, { file, expires: Date.now() + FILE_TTL_MS });
  return file;
}

// --- Errors -----------------------------------------------------------------

class VideoGoneError extends Error {}

const isFileReferenceError = (error: unknown) =>
  error instanceof errors.RPCError && /FILE_REFERENCE_/.test(error.errorMessage);

/** The bot can't see the channel (not an admin, removed, wrong channel…). */
const isAccessError = (error: unknown) =>
  (error instanceof errors.RPCError && /CHANNEL|CHAT_|PEER_ID|BOT_/.test(error.errorMessage)) ||
  (error instanceof Error && /input entity/i.test(error.message));

/** Telegram's 420 rate limits: FLOOD_WAIT_X says how long; a bare FLOOD doesn't. */
function floodDelayMs(error: unknown, attempt: number): number | null {
  if (error instanceof errors.FloodWaitError) return Math.min(error.seconds, 60) * 1000;
  if (error instanceof errors.RPCError && (error.code === 420 || /FLOOD/.test(error.errorMessage))) {
    return 1000 * 2 ** Math.min(attempt, 4); // 1s, 2s, 4s, 8s, 16s
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Leases: which bot serves a viewer -----------------------------------------

class Lease {
  private released = false;
  constructor(public bot: StreamBot) {
    bot.active++;
  }
  switchTo(other: StreamBot) {
    this.bot.active--;
    this.bot = other;
    other.active++;
  }
  release() {
    if (this.released) return;
    this.released = true;
    this.bot.active--;
  }
}

/**
 * Runs a Telegram operation on the lease's bot, moving the viewer to another
 * bot when this one is rate-limited or can't read the channel.
 */
async function withFailover<T>(lease: Lease, op: (client: TelegramClient, bot: StreamBot) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const bot = lease.bot;
    try {
      let client: TelegramClient;
      try {
        client = await bot.client;
      } catch (error) {
        markUnusable(bot, `login failed: ${(error as Error).message}`);
        throw error;
      }
      return await op(client, bot);
    } catch (error) {
      if (error instanceof VideoGoneError) throw error;

      const delay = floodDelayMs(error, attempt);
      if (delay !== null) {
        bot.coolingUntil = Date.now() + delay;
        const other = pickBot(getBotPool(), Date.now(), bot);
        if (other && other.coolingUntil <= Date.now()) {
          console.warn(`[mtproto] bot ${bot.number} rate-limited; moving a viewer to bot ${other.number}`);
          lease.switchTo(other);
        } else {
          console.warn(`[mtproto] all bots rate-limited; waiting ${delay / 1000}s`);
          await sleep(delay);
        }
        continue;
      }

      if (bot.unusable || isAccessError(error)) {
        markUnusable(bot, bot.unusable ?? `can't read the channel (${(error as Error).message}) — make it a channel admin`);
        const other = pickBot(getBotPool(), Date.now(), bot);
        if (!other) throw error;
        lease.switchTo(other);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Telegram download failed after retries.");
}

async function fetchChunk(lease: Lease, ref: VideoMessageRef, offset: number): Promise<Uint8Array> {
  return withFailover(lease, async (client, bot) => {
    let file = await resolveVideo(bot, client, ref);
    if (!file) throw new VideoGoneError();
    let dcId = file.dcId;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await client.invokeWithSender(
          new Api.upload.GetFile({ location: file.location, offset: bigInt(offset), limit: CHUNK_SIZE }),
          await client.getSender(dcId),
        );
        if (!(result instanceof Api.upload.File)) throw new Error("Telegram CDN redirects are not supported.");
        return result.bytes;
      } catch (error) {
        if (isFileReferenceError(error)) {
          file = await resolveVideo(bot, client, ref, true);
          if (!file) throw new VideoGoneError();
        } else if (error instanceof errors.FileMigrateError) {
          dcId = error.newDc;
        } else {
          throw error; // rate limits / access errors → withFailover
        }
      }
    }
    throw new Error("Telegram kept rejecting the file location.");
  });
}

export async function streamVideoFromTelegram(
  ref: VideoMessageRef,
  request: Request,
  knownMimeType: string | null,
): Promise<Response> {
  const first = pickBot(getBotPool());
  if (!first) return jsonError(503, "No Telegram bot is available for streaming. Check the server logs.");
  const lease = new Lease(first);

  let file: VideoFile;
  try {
    const resolved = await withFailover(lease, (client, bot) => resolveVideo(bot, client, ref));
    if (!resolved) throw new VideoGoneError();
    file = resolved;
  } catch (error) {
    lease.release();
    if (error instanceof VideoGoneError) return jsonError(404, "This video was removed from Telegram.");
    throw error;
  }

  const range = parseRange(request.headers.get("range"), file.size);
  if (range === "unsatisfiable") {
    lease.release();
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
  }
  const { start, end } = range ?? { start: 0, end: file.size - 1 };

  const body = createChunkedStream({
    start,
    end,
    chunkSize: CHUNK_SIZE,
    fetchChunk: (offset) => fetchChunk(lease, ref, offset),
    readAheadChunks: Math.max(1, Math.round((READ_AHEAD_MB * 1024 * 1024) / CHUNK_SIZE)),
    concurrency: CONCURRENCY,
    onFinish: () => lease.release(),
  });

  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": knownMimeType || file.mimeType || "video/mp4",
      "Content-Length": String(end - start + 1),
      ...(range && { "Content-Range": `bytes ${start}-${end}/${file.size}` }),
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Stream-Source": "mtproto",
      "X-Stream-Bot": String(lease.bot.number),
    },
  });
}

// --- Used by sync: which channel posts still exist ---------------------------

/**
 * Returns the ids of `messageIds` that no longer exist (or no longer carry a
 * file) in the channel. Throws if Telegram can't be asked, so callers never
 * delete anything on a failed check.
 */
export async function findDeletedMessages(chatId: number, messageIds: number[]): Promise<number[]> {
  const bot = pickBot(getBotPool());
  if (!bot) throw new Error("No Telegram bot is available.");
  const client = await bot.client;

  const deleted: number[] = [];
  for (let i = 0; i < messageIds.length; i += 100) {
    const batch = messageIds.slice(i, i + 100);
    const messages = await client.getMessages(chatId, { ids: batch });
    batch.forEach((id, index) => {
      const message = messages[index];
      if (!(message instanceof Api.Message) || !message.media) deleted.push(id);
    });
  }
  return deleted;
}
