"use client";

import { useMemo, useState } from "react";
import type { Media } from "@/types/media";
import { orderCategories } from "@/config/categories";
import { rankByFrequency } from "@/utils/collections";

export const ALL_GENRES = "All";

/**
 * Category pills derived from the items: canonical categories first (see
 * `config/categories`), then any others by frequency. State is local, so
 * each view filters independently.
 */
export function useGenreFilter(items: readonly Media[]) {
  const [selected, setSelected] = useState(ALL_GENRES);

  const genres = useMemo(
    () => [ALL_GENRES, ...orderCategories(rankByFrequency(items.map((item) => item.genres)))],
    [items],
  );

  const filtered = useMemo(
    () => (selected === ALL_GENRES ? items : items.filter((item) => item.genres.includes(selected))),
    [items, selected],
  );

  return { genres, selected, select: setSelected, filtered };
}
