"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Media } from "@/types/media";
import { MediaDetailModal } from "./MediaDetailModal";

interface OpenOptions {
  /** Start playback immediately (hero "play" CTA). */
  autoplay?: boolean;
}

interface MediaDetailContextValue {
  openDetails: (media: Media, options?: OpenOptions) => void;
}

const MediaDetailContext = createContext<MediaDetailContextValue | null>(null);

/** Hosts a single app-wide detail modal any card can open. */
export function MediaDetailProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<{ media: Media; autoplay: boolean } | null>(null);

  const openDetails = useCallback(
    (media: Media, { autoplay = false }: OpenOptions = {}) => setActive({ media, autoplay }),
    [],
  );
  const close = useCallback(() => setActive(null), []);
  const value = useMemo(() => ({ openDetails }), [openDetails]);

  return (
    <MediaDetailContext value={value}>
      {children}
      <MediaDetailModal media={active?.media ?? null} autoplay={active?.autoplay} onClose={close} />
    </MediaDetailContext>
  );
}

export function useMediaDetail() {
  const context = useContext(MediaDetailContext);
  if (!context) throw new Error("useMediaDetail must be used within <MediaDetailProvider>");
  return context;
}
