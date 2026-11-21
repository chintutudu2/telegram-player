import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { ApiResponse } from "./http";

/** Route-handler helpers producing the shared `ApiResponse` envelope. */

export const jsonOk = <T>(data: T, init?: ResponseInit) =>
  Response.json({ data } satisfies ApiResponse<T>, init);

export const jsonError = (status: number, message: string) =>
  Response.json({ error: { message } } satisfies ApiResponse<never>, { status });

/** CDN-friendly caching for public catalog responses. */
export const publicCache = (maxAgeSeconds: number): ResponseInit => ({
  headers: {
    "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 10}`,
  },
});

/** Converts unexpected failures into a 502 envelope, leaving Next.js control flow intact. */
export async function handleRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[api]", error);
    return jsonError(502, "Upstream media service is unavailable.");
  }
}
