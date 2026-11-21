import { Flame, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/feedback";
import { EmptyLibrary } from "@/features/catalog/EmptyLibrary";
import { GenreFilterSection } from "@/features/catalog/GenreFilterSection";
import { HeroCarousel } from "@/features/catalog/HeroCarousel";
import { MediaRow } from "@/features/catalog/MediaRow";
import { getFeatured, getMediaList } from "@/services/media/catalog.service";
import type { Media } from "@/types/media";
import { uniqueBy } from "@/utils/collections";

/** Long-running, well-rated shows first: the binge-worthy shortlist. */
const byBingeValue = (a: Media, b: Media) =>
  (b.episodes ?? 0) * b.rating - (a.episodes ?? 0) * a.rating;

export async function SeriesView() {
  const [featured, topRated, trending, popular] = await Promise.all([
    getFeatured("tv"),
    getMediaList("tv", "top_rated", { limit: 12 }),
    getMediaList("tv", "trending", { limit: 12 }),
    getMediaList("tv", "popular"),
  ]);

  const binge = topRated.toSorted(byBingeValue);
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
      <MediaRow title="Binge-Worthy Series" icon={<Sparkles />} items={binge} />
      <MediaRow title="Trending Now" icon={<Flame />} items={trending} />
      <GenreFilterSection title="Browse by Genre" items={library} />
    </>
  );
}
