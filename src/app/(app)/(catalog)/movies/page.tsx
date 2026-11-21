import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogSkeleton } from "@/features/catalog/CatalogSkeleton";
import { MoviesView } from "@/features/movies/MoviesView";

export const metadata: Metadata = { title: "Movies" };

export default function MoviesPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <MoviesView />
    </Suspense>
  );
}
