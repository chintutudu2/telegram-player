import "server-only";

import { revalidateTag } from "next/cache";
import { isFirebaseAdminConfigured } from "@/services/firebase/firebase.admin";
import { CATALOG_TAG } from "@/services/library/library.urls";
import { TelegramApiError } from "@/services/telegram/telegram.client";
import { getTelegramConfig, type TelegramConfig } from "@/services/telegram/telegram.config";
import type { IngestReport } from "@/services/telegram/telegram.ingest";
import { secretsMatch } from "@/utils/secret";
import { handleRoute, jsonError, jsonOk } from "@/utils/route";

/**
 * Shared guard for Telegram ingestion endpoints: checks configuration,
 * authenticates the caller, runs the ingestion, and refreshes the catalog.
 */
export function telegramIngestRoute(
  getProvidedSecret: (request: Request) => string | null,
  ingest: (config: TelegramConfig, request: Request) => Promise<IngestReport | Response>,
) {
  return (request: Request) =>
    handleRoute(async () => {
      const config = getTelegramConfig();
      if (!config || !isFirebaseAdminConfigured()) {
        return jsonError(503, "Telegram sync needs TELEGRAM_BOT_TOKEN and Firebase Admin credentials.");
      }
      if (!config.syncSecret) return jsonError(503, "Set TELEGRAM_SYNC_SECRET to enable ingestion.");
      if (!secretsMatch(getProvidedSecret(request), config.syncSecret)) {
        return jsonError(401, "Unauthorized.");
      }
      if (config.allowedChatIds.size === 0) {
        return jsonError(503, "Set TELEGRAM_CHANNEL_ID so uploads can be trusted.");
      }

      try {
        const result = await ingest(config, request);
        if (result instanceof Response) return result;
        // Expire immediately so the next page view shows new uploads.
        if (result.saved.length > 0 || result.enrichment?.enriched.length || result.pruned?.removed.length) {
          revalidateTag(CATALOG_TAG, { expire: 0 });
        }
        return jsonOk(result);
      } catch (error) {
        // Telegram descriptions are safe to surface (they never contain the token).
        if (error instanceof TelegramApiError) {
          return jsonError(error.code === 409 ? 409 : 502, error.message);
        }
        throw error;
      }
    });
}
