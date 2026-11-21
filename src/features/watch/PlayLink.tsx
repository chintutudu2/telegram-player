"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import type { Media } from "@/types/media";
import { enterFullscreen } from "@/utils/fullscreen";

export const watchHref = (media: Pick<Media, "id">) => `/watch/${media.id}`;

// `media` replaces the anchor's own (rarely used) `media` attribute.
type PlayLinkProps = Omit<ComponentProps<typeof Link>, "href" | "media"> & { media: Pick<Media, "id"> };

/**
 * Opens the full-screen player for a title. Fullscreen has to be requested
 * inside the click itself; the watch page then fills it.
 */
export function PlayLink({ media, onClick, ...props }: PlayLinkProps) {
  return (
    <Link
      href={watchHref(media)}
      onClick={(event) => {
        // Cmd/Ctrl/Shift-click opens a new tab or window: leave this page alone.
        const newContext = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
        if (!newContext) enterFullscreen();
        onClick?.(event);
      }}
      {...props}
    />
  );
}
