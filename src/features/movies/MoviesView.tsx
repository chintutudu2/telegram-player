import { PageHeader } from "@/components/ui/feedback";
import { EmptyLibrary } from "@/features/catalog/EmptyLibrary";
import { GenreFilterSection } from "@/features/catalog/GenreFilterSection";
import { HeroCarousel } from "@/features/catalog/HeroCarousel";
import { getFeatured, getMediaList } from "@/services/media/catalog.service";
import { uniqueBy } from "@/utils/collections";

export async function MoviesView() {
  const [featured, popular, topRated, trending] = await Promise.all([
    getFeatured("movie"),
    getMediaList("movie", "popular"),
    getMediaList("movie", "top_rated"),
    getMediaList("movie", "trending"),
  ]);

  // One deduplicated pool gives the genre filter the widest choice.
  const library = uniqueBy([...popular, ...trending, ...topRated], (m) => m.id);

  if (library.length === 0) {
    return (
      <>
        <PageHeader title="Movies" />
        <EmptyLibrary kind="movies" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Movies" hidden />
      <HeroCarousel items={featured} label="Featured movies" />
      <GenreFilterSection title="Browse by Genre" items={library} />
    </>
  );
}
