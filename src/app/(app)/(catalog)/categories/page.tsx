import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogSkeleton } from "@/features/catalog/CatalogSkeleton";
import { CategoriesView } from "@/features/categories/CategoriesView";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CategoriesView />
    </Suspense>
  );
}
