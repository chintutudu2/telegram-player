import { pullUpdates } from "@/services/telegram/telegram.ingest";
import { bearerToken } from "@/utils/secret";
import { telegramIngestRoute } from "../telegram-route";

/**
 * GET|POST /api/telegram/sync  (Authorization: Bearer $TELEGRAM_SYNC_SECRET)
 *
 * Pull mode: drains pending bot updates via `getUpdates` and indexes new
 * uploads. Call it manually or from a cron (e.g. Vercel Cron sends GET).
 * Use either this or the webhook — Telegram disables `getUpdates` while a
 * webhook is set.
 */
const handler = telegramIngestRoute(bearerToken, (config) => pullUpdates(config));

export const GET = handler;
export const POST = handler;
