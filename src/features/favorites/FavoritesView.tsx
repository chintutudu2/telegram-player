"use client";

import { Heart } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { CatalogSkeleton } from "@/features/catalog/CatalogSkeleton";
import { MediaGrid } from "@/features/catalog/MediaGrid";
import { useFavorites } from "@/hooks/useFavorites";
import { useHydrated } from "@/hooks/useHydrated";

export function FavoritesView() {
  const { favorites } = useFavorites();
  // Favorites live in browser storage; avoid flashing the empty state on SSR.
  const hydrated = useHydrated();

  return (
    <>
      <PageHeader title="Favorites" description="Titles you saved for later." />
      {!hydrated ? (
        <CatalogSkeleton />
      ) : favorites.length ? (
        <MediaGrid items={favorites} />
      ) : (
        <EmptyState
          icon={Heart}
          title="No favorites yet"
          description="Tap the heart on any title to keep it here."
        >
          <ButtonLink href="/" variant="primary">
            Explore titles
          </ButtonLink>
        </EmptyState>
      )}
    </>
  );
}
