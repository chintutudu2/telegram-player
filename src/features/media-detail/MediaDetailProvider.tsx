"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Media } from "@/types/media";
import { MediaDetailModal } from "./MediaDetailModal";

interface MediaDetailContextValue {
  openDetails: (media: Media) => void;
}

const MediaDetailContext = createContext<MediaDetailContextValue | null>(null);

/** Hosts a single app-wide detail modal any card can open. */
export function MediaDetailProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Media | null>(null);

  const openDetails = useCallback((media: Media) => setActive(media), []);
  const close = useCallback(() => setActive(null), []);
  const value = useMemo(() => ({ openDetails }), [openDetails]);

  return (
    <MediaDetailContext value={value}>
      {children}
      <MediaDetailModal media={active} onClose={close} />
    </MediaDetailContext>
  );
}

export function useMediaDetail() {
  const context = useContext(MediaDetailContext);
  if (!context) throw new Error("useMediaDetail must be used within <MediaDetailProvider>");
  return context;
}
