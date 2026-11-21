import type { MediaScope } from "@/types/media";

/** Catalog sections: the top bar's links and the search scope. */
export interface CatalogSection {
  label: string;
  href: string;
  scope: MediaScope;
}

export const catalogSections: CatalogSection[] = [
  { label: "Home", href: "/", scope: "all" },
  { label: "Movies", href: "/movies", scope: "movie" },
  { label: "Series", href: "/series", scope: "tv" },
];

const matchesSection = (section: CatalogSection, pathname: string) =>
  section.href === "/" ? pathname === "/" : pathname.startsWith(section.href);

/** The section a path belongs to; `null` for pages outside the catalog sections. */
export const activeSection = (pathname: string): CatalogSection | null =>
  catalogSections.find((section) => matchesSection(section, pathname)) ?? null;

/** Search scope for a path (defaults to everything). */
export const sectionForPath = (pathname: string): CatalogSection =>
  activeSection(pathname) ?? catalogSections[0];
