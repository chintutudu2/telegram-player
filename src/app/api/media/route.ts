import type { NextRequest } from "next/server";
import { getMediaList, isCatalogConfigured, searchMedia } from "@/services/media/catalog.service";
import { MEDIA_LIST_KINDS, MEDIA_SCOPES } from "@/types/media";
import { handleRoute, jsonError, jsonOk, publicCache } from "@/utils/route";
import { oneOf } from "@/utils/params";

/**
 * GET /api/media
 *   ?query=…            → search (optionally scoped)
 *   ?list=trending|popular|top_rated
 *   &scope=all|movie|tv (default: all)
 *
 * Browser code fetches through here; reads come from the cached Firestore
 * library snapshot, so traffic does not multiply Firestore reads.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    if (!isCatalogConfigured()) return jsonError(503, "Firebase is not configured.");

    const params = request.nextUrl.searchParams;

    const scope = oneOf(params.get("scope") ?? "all", MEDIA_SCOPES);
    if (!scope) return jsonError(400, `scope must be one of: ${MEDIA_SCOPES.join(", ")}`);

    const query = params.get("query");
    if (query !== null) {
      return jsonOk(await searchMedia(query, scope), publicCache(60));
    }

    const kind = oneOf(params.get("list") ?? "trending", MEDIA_LIST_KINDS);
    if (!kind) return jsonError(400, `list must be one of: ${MEDIA_LIST_KINDS.join(", ")}`);

    return jsonOk(await getMediaList(scope, kind), publicCache(300));
  });
}
