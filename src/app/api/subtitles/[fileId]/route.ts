import type { NextRequest } from "next/server";
import { isFirebaseWebConfigured } from "@/services/firebase/firebase.web";
import { getTelegramConfig } from "@/services/telegram/telegram.config";
import { serveSubtitle } from "@/services/telegram/telegram.stream";
import { telegramFileId } from "@/utils/params";
import { handleRoute, jsonError } from "@/utils/route";

/**
 * GET /api/subtitles/:fileId — a library subtitle file as WebVTT (SubRip is
 * converted), for the player's <track> elements.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/subtitles/[fileId]">) {
  return handleRoute(async () => {
    const fileId = telegramFileId((await ctx.params).fileId);
    if (!fileId) return jsonError(400, "Invalid file id.");

    const config = getTelegramConfig();
    if (!config || !isFirebaseWebConfigured()) return jsonError(503, "Streaming is not configured.");

    return serveSubtitle(config, fileId);
  });
}
