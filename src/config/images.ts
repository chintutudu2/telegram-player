/**
 * Image hosts routed through Next.js image optimization. Shared by
 * `next.config.ts` and `MediaImage`, which loads any other host (e.g. a
 * `thumbnailUrl` typed into Firestore by hand) unoptimized instead of failing.
 */
export const OPTIMIZED_IMAGE_HOSTS = [
  "image.tmdb.org", // TMDB posters/backdrops (upload enrichment)
] as const;

export function isOptimizableImage(src: string): boolean {
  // Local images are Telegram thumbnails behind the sign-in gate (proxy.ts).
  // The optimizer fetches them without the viewer's cookie, so let the
  // browser load them directly; they're small JPEGs anyway.
  if (src.startsWith("/")) return false;
  try {
    const { protocol, hostname } = new URL(src);
    return protocol === "https:" && (OPTIMIZED_IMAGE_HOSTS as readonly string[]).includes(hostname);
  } catch {
    return false;
  }
}
