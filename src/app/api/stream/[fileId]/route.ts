import type { NextRequest } from "next/server";
import { isFirebaseWebConfigured } from "@/services/firebase/firebase.web";
import { getTelegramConfig } from "@/services/telegram/telegram.config";
import { streamTelegramFile } from "@/services/telegram/telegram.stream";
import { telegramFileId } from "@/utils/params";
import { handleRoute, jsonError } from "@/utils/route";

/**
 * GET /api/stream/:fileId — byte-range capable proxy for library videos and
 * thumbnails. The bot token never leaves the server.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/stream/[fileId]">) {
  return handleRoute(async () => {
    const fileId = telegramFileId((await ctx.params).fileId);
    if (!fileId) return jsonError(400, "Invalid file id.");

    const config = getTelegramConfig();
    if (!config || !isFirebaseWebConfigured()) return jsonError(503, "Streaming is not configured.");

    return streamTelegramFile(config, fileId, request);
  });
}
