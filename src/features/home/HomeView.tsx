import { Flame, Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/feedback";
import { EmptyLibrary } from "@/features/catalog/EmptyLibrary";
import { GenreFilterSection } from "@/features/catalog/GenreFilterSection";
import { HeroCarousel } from "@/features/catalog/HeroCarousel";
import { MediaRow } from "@/features/catalog/MediaRow";
import { getFeatured, getMediaList } from "@/services/media/catalog.service";

export async function HomeView() {
  const [featured, trending, topRated, popular] = await Promise.all([
    getFeatured("all"),
    getMediaList("all", "trending"),
    getMediaList("all", "top_rated", { limit: 16 }),
    getMediaList("all", "popular", { limit: 16 }),
  ]);

  if (trending.length === 0) {
    return (
      <>
        <PageHeader title="Home" hidden />
        <EmptyLibrary />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Home" hidden />
      <HeroCarousel items={featured} label="Featured this week" />
      <GenreFilterSection title="Select Categories" items={trending} />
      <MediaRow title="Popular Right Now" icon={<Flame />} items={popular} />
      <MediaRow title="Top Rated" icon={<Trophy />} items={topRated} />
    </>
  );
}
