import type { ReactNode } from "react";
import { FirebaseNotConfigured } from "@/features/catalog/FirebaseNotConfigured";
import { isCatalogConfigured } from "@/services/media/catalog.service";

/**
 * Gate for every catalog route (/, /movies, /series, /categories, /watch).
 * The route group adds no URL segment; it just keeps this check in one place.
 */
export default function CatalogLayout({ children }: { children: ReactNode }) {
  return isCatalogConfigured() ? children : <FirebaseNotConfigured />;
}
