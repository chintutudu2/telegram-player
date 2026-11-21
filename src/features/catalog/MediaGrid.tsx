import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import type { Media } from "@/types/media";
import { MediaCard } from "./MediaCard";

const GRID_SIZES = "(min-width: 1536px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw";

export function MediaGrid({ items }: { items: readonly Media[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Nothing here yet"
        description="No titles match this filter. Try another category."
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 2xl:grid-cols-5">
      {items.map((media) => (
        // min-w-0 stops long (truncated) titles from widening grid tracks.
        <li key={media.id} className="min-w-0">
          <MediaCard media={media} sizes={GRID_SIZES} />
        </li>
      ))}
    </ul>
  );
}
