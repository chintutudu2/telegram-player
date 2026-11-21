import { getMediaDetails, isCatalogConfigured } from "@/services/media/catalog.service";
import { MEDIA_TYPES } from "@/types/media";
import { oneOf, safeId } from "@/utils/params";
import { handleRoute, jsonError, jsonOk, publicCache } from "@/utils/route";

/** GET /api/media/:type/:id — full details incl. stream URL and episodes. */
export async function GET(_request: Request, ctx: RouteContext<"/api/media/[type]/[id]">) {
  return handleRoute(async () => {
    if (!isCatalogConfigured()) return jsonError(503, "Firebase is not configured.");

    const { type: rawType, id: rawId } = await ctx.params;
    const type = oneOf(rawType, MEDIA_TYPES);
    const id = safeId(rawId);
    if (!type || !id) return jsonError(400, "Invalid media reference.");

    const details = await getMediaDetails(type, id);
    return details ? jsonOk(details, publicCache(60)) : jsonError(404, "Media not found.");
  });
}
