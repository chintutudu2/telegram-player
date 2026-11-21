import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import type { Media } from "@/types/media";
import { formatRating, mediaTypeLabel } from "@/utils/format";

interface SearchResultsProps {
  id: string;
  query: string;
  results: readonly Media[];
  isPending: boolean;
  error?: Error;
  onSelect: (media: Media) => void;
}

function Status({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function SearchResults({ id, query, results, isPending, error, onSelect }: SearchResultsProps) {
  const body = (() => {
    if (error) return <Status>Search is unavailable right now. Please try again.</Status>;
    if (results.length === 0) {
      return <Status>{isPending ? "Searching…" : `No results for “${query}”.`}</Status>;
    }
    return (
      <ul className="divide-y divide-white/5">
        {results.map((media) => (
          <li key={media.id}>
            <button
              type="button"
              onClick={() => onSelect(media)}
              className="flex w-full cursor-pointer items-center gap-4 px-3 py-2.5 text-left transition-colors hover:bg-white/5 focus-visible:bg-white/5"
            >
              <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg">
                <MediaImage src={media.posterUrl} alt="" sizes="44px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{media.title}</span>
                <span className="text-sm text-muted">
                  {mediaTypeLabel(media)}
                  {media.releaseYear && ` · ${media.releaseYear}`}
                </span>
              </span>
              {media.rating > 0 && (
                <span className="flex items-center gap-1 text-sm text-fg/80">
                  <Star className="size-3.5 fill-star text-star" aria-hidden />
                  {formatRating(media.rating)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    );
  })();

  return (
    <div
      id={id}
      role="region"
      aria-label="Search results"
      aria-busy={isPending}
      className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(28rem,70dvh)] overflow-y-auto rounded-3xl border border-white/10 bg-raised/95 p-2 shadow-2xl backdrop-blur-xl"
    >
      {body}
    </div>
  );
}
