/**
 * Document-level fullscreen. The whole page goes fullscreen (not the
 * `<video>`), so the player's own overlay (back, episodes…) stays usable and
 * client-side navigation keeps the fullscreen state.
 *
 * Browsers only allow entering from a user gesture: call it in a click handler.
 * iPhone Safari has no document fullscreen; the player fills the viewport there.
 */
export function enterFullscreen() {
  if (document.fullscreenElement || !document.fullscreenEnabled) return;
  document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
