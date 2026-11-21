import { PageHeader } from "@/components/ui/feedback";
import { EmptyLibrary } from "@/features/catalog/EmptyLibrary";
import { GenreFilterSection } from "@/features/catalog/GenreFilterSection";
import { HeroCarousel } from "@/features/catalog/HeroCarousel";
import { getFeatured, getMediaList } from "@/services/media/catalog.service";

export async function HomeView() {
  const [featured, trending] = await Promise.all([getFeatured("all"), getMediaList("all", "trending")]);

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
    </>
  );
}
