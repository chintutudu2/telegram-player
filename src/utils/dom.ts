/**
 * For ref cleanups: runs `fn` once the current commit settles, but only if
 * `node` was really removed or hidden (React Activity hides pages with
 * `display: none`).
 *
 * In development React StrictMode detaches and re-attaches refs once on
 * mount while the node stays on screen; acting immediately there would
 * undo the work of the attach (e.g. pause a video that just autoplayed).
 */
export function afterLeavingScreen(node: Element, fn: () => void) {
  setTimeout(() => {
    const onScreen = node.isConnected && node.checkVisibility?.();
    if (!onScreen) fn();
  });
}
