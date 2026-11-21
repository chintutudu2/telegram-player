import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogSkeleton } from "@/features/catalog/CatalogSkeleton";
import { SeriesView } from "@/features/series/SeriesView";

export const metadata: Metadata = { title: "Series" };

export default function SeriesPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <SeriesView />
    </Suspense>
  );
}
