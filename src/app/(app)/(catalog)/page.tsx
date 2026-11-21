import { Suspense } from "react";
import { CatalogSkeleton } from "@/features/catalog/CatalogSkeleton";
import { HomeView } from "@/features/home/HomeView";

export default function HomePage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <HomeView />
    </Suspense>
  );
}
