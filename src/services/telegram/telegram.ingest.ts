import "server-only";

import { splitCategories } from "@/config/categories";
import { telegramFileUrl } from "@/services/library/library.urls";
import { type EnrichmentReport, enrichMissing, lookupTmdb } from "@/services/library/library.enrichment";
import type { MediaDocument, TmdbEnrichment } from "@/services/library/media.schema";
import {
  deleteMedia,
  getUpdateOffset,
  listTelegramMedia,
  removeReplacedMedia,
  setUpdateOffset,
  upsertMediaRecord,
} from "@/services/library/media.writer";
import { isTmdbConfigured } from "@/services/tmdb/tmdb.client";
import { formatDurationSeconds, type ParsedCaption, parseCaption, slugify } from "./caption.parser";
import { isMtprotoConfigured } from "./mtproto.client";
import { findDeletedMessages } from "./mtproto.stream";
import { TelegramApiError, telegramApi } from "./telegram.client";
import type { TelegramConfig } from "./telegram.config";
import type { TelegramDocument, TelegramMessage, TelegramUpdate, TelegramVideo } from "./telegram.types";

export interface IngestReport {
  received: number;
  saved: {
    id: string;
    title: string;
    type: string;
    /** TMDB result at upload: matched, no match, or not attempted/failed (backfilled later). */
    poster: "found" | "not_found" | "pending";
  }[];
  skipped: { updateId: number; reason: string }[];
  /** TMDB backfill results (pull sync only). */
  enrichment?: EnrichmentReport;
  /** Pull sync only: true when a webhook is registered, so uploads arrive by push instead. */
  webhookActive?: boolean;
  /** Pull sync only: entries removed because their channel post was deleted. */
  pruned?: PruneReport;
}

export interface PruneReport {
  enabled: boolean;
  removed: string[];
  /** Why nothing was removed, if the check was skipped. */
  skipped?: string;
}

const VIDEO_FILE_RE = /\.(mp4|m4v|mov|webm|mkv)$/i;

const messageOf = (update: TelegramUpdate): TelegramMessage | undefined =>
  update.channel_post ?? update.edited_channel_post ?? update.message ?? update.edited_message;

/** Videos arrive as `video`, or as `document` when sent "as file". */
function videoOf(message: TelegramMessage): (TelegramVideo | TelegramDocument) | null {
  if (message.video) return message.video;
  const doc = message.document;
  if (doc && (doc.mime_type?.startsWith("video/") || VIDEO_FILE_RE.test(doc.file_name ?? ""))) return doc;
  return null;
}

/** Best-effort TMDB lookup at upload time; failures are retried by the next sync's backfill. */
async function enrich(caption: ParsedCaption): Promise<TmdbEnrichment | undefined> {
  if (!isTmdbConfigured()) return undefined;
  try {
    return await lookupTmdb(caption.title, caption.type, caption.releaseYear);
  } catch (error) {
    console.warn(`[telegram] TMDB enrichment failed for "${caption.title}"`, error);
    return undefined;
  }
}

/** Validates, parses and upserts a batch of updates. Idempotent per file. */
export async function ingestUpdates(config: TelegramConfig, updates: TelegramUpdate[]): Promise<IngestReport> {
  const report: IngestReport = { received: updates.length, saved: [], skipped: [] };
  const enrichments = new Map<string, Promise<TmdbEnrichment | undefined>>();
  const skip = (updateId: number, reason: string) => report.skipped.push({ updateId, reason });

  for (const update of updates) {
    const message = messageOf(update);
    if (!message) {
      skip(update.update_id, "not a message");
      continue;
    }
    if (!config.allowedChatIds.has(message.chat.id)) {
      skip(update.update_id, `chat ${message.chat.id} is not in TELEGRAM_CHANNEL_ID / TELEGRAM_ADMIN_IDS`);
      continue;
    }
    const video = videoOf(message);
    if (!video) {
      skip(update.update_id, "no video attached");
      continue;
    }
    const caption = parseCaption(message.caption);
    if (!caption.ok) {
      skip(update.update_id, caption.reason);
      continue;
    }

    const parsed = caption.value;
    const enrichKey = `${parsed.type}:${parsed.title}:${parsed.releaseYear}`;
    if (!enrichments.has(enrichKey)) enrichments.set(enrichKey, enrich(parsed));
    const tmdb = await enrichments.get(enrichKey)!;

    const durationSeconds = parsed.durationSeconds ?? ("duration" in video ? video.duration : null) ?? null;
    const thumb = video.thumbnail;

    const id = video.file_unique_id;
    const record: MediaDocument = {
      title: parsed.title,
      type: parsed.type,
      // Stored as written (canonicalised), e.g. "Comedy, Adventure"; split on read.
      category: splitCategories(parsed.category).join(", ") || "Uncategorized",
      telegramFileId: video.file_id,
      duration: durationSeconds ? formatDurationSeconds(durationSeconds) : "",
      thumbnailUrl: thumb ? telegramFileUrl(thumb.file_id) : null,
      createdAt: message.date * 1000,
      durationSeconds,
      mimeType: video.mime_type ?? null,
      fileSize: video.file_size ?? null,
      thumbnailFileId: thumb?.file_id ?? null,
      releaseYear: parsed.releaseYear,
      seriesKey: parsed.type === "series" ? slugify(parsed.title) : null,
      season: parsed.season,
      episode: parsed.episode,
      episodeTitle: parsed.episodeTitle,
      telegram: { chatId: message.chat.id, messageId: message.message_id },
      ...(tmdb && { tmdb }),
    };

    await upsertMediaRecord(id, record);
    // A post whose file was replaced keeps its message id but gets a new file id.
    await removeReplacedMedia(message.chat.id, message.message_id, id);
    report.saved.push({
      id,
      title: record.title,
      type: record.type,
      poster: tmdb ? (tmdb.found ? "found" : "not_found") : "pending",
    });
  }

  return report;
}

const MAX_PAGES = 5;

/**
 * Pull mode: drains pending updates with `getUpdates`, persisting the
 * offset so each update is processed once. The offset only advances after a
 * page is stored, so a failure mid-batch is retried on the next sync.
 * Then backfills TMDB metadata for older or hand-entered documents.
 * Note: Telegram rejects `getUpdates` (409) while a webhook is registered.
 */
export async function pullUpdates(config: TelegramConfig): Promise<IngestReport> {
  const total: IngestReport = { received: 0, saved: [], skipped: [] };
  let offset = await getUpdateOffset();

  for (let page = 0; page < MAX_PAGES; page++) {
    let updates;
    try {
      updates = await telegramApi.getUpdates(config, offset);
    } catch (error) {
      // 409: a webhook is registered, so uploads are pushed to /api/telegram/webhook.
      if (error instanceof TelegramApiError && error.code === 409) {
        total.webhookActive = true;
        break;
      }
      throw error;
    }
    if (updates.length === 0) break;

    const report = await ingestUpdates(config, updates);
    total.received += report.received;
    total.saved.push(...report.saved);
    total.skipped.push(...report.skipped);

    offset = Math.max(...updates.map((u) => u.update_id)) + 1;
    await setUpdateOffset(offset);
    if (updates.length < 100) break;
  }

  // Fill in posters/synopses for anything still missing them.
  total.enrichment = await enrichMissing();
  total.pruned = await pruneDeletedPosts();
  return total;
}

/**
 * The Bot API never reports deleted posts, so ask Telegram (MTProto) which
 * posts still exist and remove entries for the ones that don't. Refuses to
 * remove more than half the library at once (e.g. if the bot lost access).
 */
async function pruneDeletedPosts(): Promise<PruneReport> {
  if (!isMtprotoConfigured()) return { enabled: false, removed: [] };
  try {
    const entries = await listTelegramMedia();
    const gone: typeof entries = [];
    const notes: string[] = [];
    for (const [chatId, items] of Map.groupBy(entries, (entry) => entry.chatId)) {
      const messageIds = [...new Set(items.map((item) => item.messageId))];
      const deleted = new Set(await findDeletedMessages(chatId, messageIds));
      // Every post "missing" almost always means lost access, not deletion.
      if (deleted.size === messageIds.length) {
        notes.push(`All ${messageIds.length} post(s) in channel ${chatId} look deleted — skipped. Check the bot is still a channel admin.`);
        continue;
      }
      gone.push(...items.filter((item) => deleted.has(item.messageId)));
    }
    if (notes.length) return { enabled: true, removed: [], skipped: notes.join(" ") };
    if (gone.length > 3 && gone.length > entries.length / 2) {
      return {
        enabled: true,
        removed: [],
        skipped: `${gone.length} of ${entries.length} posts look deleted — removed nothing. Check the bot is still a channel admin.`,
      };
    }
    await deleteMedia(gone.map((item) => item.id));
    return { enabled: true, removed: gone.map((item) => item.title) };
  } catch (error) {
    console.warn("[telegram] could not check for deleted posts", error);
    return { enabled: true, removed: [], skipped: "Couldn't reach Telegram to check for deleted posts." };
  }
}
