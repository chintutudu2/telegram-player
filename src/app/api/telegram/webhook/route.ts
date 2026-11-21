import { ingestUpdates } from "@/services/telegram/telegram.ingest";
import type { TelegramUpdate } from "@/services/telegram/telegram.types";
import { jsonError } from "@/utils/route";
import { telegramIngestRoute } from "../telegram-route";

/**
 * POST /api/telegram/webhook — push mode. Register it with:
 *   setWebhook?url=<origin>/api/telegram/webhook&secret_token=$TELEGRAM_SYNC_SECRET
 * Telegram echoes the secret in `X-Telegram-Bot-Api-Secret-Token`.
 * Non-2xx responses make Telegram retry, so skipped updates still return 200.
 */
export const POST = telegramIngestRoute(
  (request) => request.headers.get("x-telegram-bot-api-secret-token"),
  async (config, request) => {
    const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
    if (!update || typeof update.update_id !== "number") return jsonError(400, "Invalid update payload.");
    return ingestUpdates(config, [update]);
  },
);
