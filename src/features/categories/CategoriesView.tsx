import { PageHeader } from "@/components/ui/feedback";
import { EmptyLibrary } from "@/features/catalog/EmptyLibrary";
import { GenreFilterSection } from "@/features/catalog/GenreFilterSection";
import { getMediaList } from "@/services/media/catalog.service";
import { uniqueBy } from "@/utils/collections";

export async function CategoriesView() {
  const lists = await Promise.all([
    getMediaList("all", "trending"),
    getMediaList("all", "popular"),
    getMediaList("all", "top_rated"),
  ]);

  const items = uniqueBy(lists.flat(), (m) => m.id);

  return (
    <>
      <PageHeader title="Categories" description="Every genre across movies and series." />
      {items.length ? <GenreFilterSection title="All Titles" items={items} /> : <EmptyLibrary />}
    </>
  );
}
