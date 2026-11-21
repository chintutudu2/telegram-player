/** Runs once when the Next.js server starts. */
export async function register() {
  // Node server only, and never during `next build` (open Telegram
  // connections would keep the build process alive).
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;

  // Log the streaming bots in now, in the background, so the first viewer
  // doesn't wait for it.
  const { warmUpStreaming } = await import("@/services/telegram/mtproto.client");
  warmUpStreaming();
}
