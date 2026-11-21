"use client";

import { type ReactNode, useCallback } from "react";
import { afterLeavingScreen } from "@/utils/dom";
import { exitFullscreen } from "@/utils/fullscreen";

/**
 * Full-viewport black stage for the watch page, covering the app chrome.
 *
 * Leaving the page (back button, browser back, a link) leaves fullscreen
 * too. With Cache Components the page is hidden rather than unmounted, and
 * either way this ref's cleanup runs.
 */
export function WatchFrame({ children }: { children: ReactNode }) {
  const exitWhenLeft = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    return () => afterLeavingScreen(node, exitFullscreen);
  }, []);

  return (
    // `m-0` beats the `space-y-*` margin of <main>, which would shorten a fixed box.
    <div ref={exitWhenLeft} className="fixed inset-0 z-50 m-0 overflow-hidden bg-black text-fg">
      {children}
    </div>
  );
}
