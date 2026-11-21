import { PageHeader } from "@/components/ui/feedback";
import { EmptyLibrary } from "@/features/catalog/EmptyLibrary";
import { GenreFilterSection } from "@/features/catalog/GenreFilterSection";
import { HeroCarousel } from "@/features/catalog/HeroCarousel";
import { getFeatured, getMediaList } from "@/services/media/catalog.service";
import { uniqueBy } from "@/utils/collections";

export async function SeriesView() {
  const [featured, topRated, trending, popular] = await Promise.all([
    getFeatured("tv"),
    getMediaList("tv", "top_rated"),
    getMediaList("tv", "trending"),
    getMediaList("tv", "popular"),
  ]);

  // One deduplicated pool gives the genre filter the widest choice.
  const library = uniqueBy([...trending, ...topRated, ...popular], (m) => m.id);

  if (library.length === 0) {
    return (
      <>
        <PageHeader title="Series" />
        <EmptyLibrary kind="series" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Series" hidden />
      <HeroCarousel items={featured} label="Featured series" />
      <GenreFilterSection title="Browse by Genre" items={library} />
    </>
  );
}
