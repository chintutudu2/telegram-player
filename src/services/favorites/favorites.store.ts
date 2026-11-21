import type { Media } from "@/types/media";

/** Persistence contract — swap localStorage for Firestore without touching UI. */
export interface FavoritesRepository {
  load(): Media[];
  save(items: Media[]): void;
}

const STORAGE_KEY = "media:favorites:v1";

export const localFavoritesRepository: FavoritesRepository = {
  load() {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as Media[]) : [];
    } catch {
      return [];
    }
  },
  save(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or blocked (private mode) — keep in-memory state only.
    }
  },
};

/**
 * Minimal external store consumed via `useSyncExternalStore`, giving every
 * component the same snapshot and syncing across browser tabs.
 */
function createFavoritesStore(repository: FavoritesRepository) {
  const EMPTY: Media[] = [];
  const listeners = new Set<() => void>();
  let snapshot: Media[] | null = null;

  const emit = () => listeners.forEach((listener) => listener());

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = repository.load();
    emit();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot: () => (snapshot ??= repository.load()),
    getServerSnapshot: () => EMPTY,
    toggle(media: Media) {
      const current = snapshot ?? repository.load();
      snapshot = current.some((item) => item.id === media.id)
        ? current.filter((item) => item.id !== media.id)
        : [media, ...current];
      repository.save(snapshot);
      emit();
    },
  };
}

export const favoritesStore = createFavoritesStore(localFavoritesRepository);
