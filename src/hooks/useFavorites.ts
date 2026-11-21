"use client";

import { useCallback, useSyncExternalStore } from "react";
import { favoritesStore } from "@/services/favorites/favorites.store";
import type { Media } from "@/types/media";

export function useFavorites() {
  const favorites = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getSnapshot,
    favoritesStore.getServerSnapshot,
  );

  const isFavorite = useCallback(
    (media: Pick<Media, "id">) => favorites.some((item) => item.id === media.id),
    [favorites],
  );

  return { favorites, isFavorite, toggleFavorite: favoritesStore.toggle };
}
