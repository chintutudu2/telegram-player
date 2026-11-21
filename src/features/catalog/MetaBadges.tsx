import { CalendarDays, Clock, Film, Star, Tv, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { Media } from "@/types/media";
import { cn } from "@/utils/cn";
import { formatCompact, formatDuration, formatRating, mediaTypeLabel } from "@/utils/format";

export type MetaField = "duration" | "year" | "rating" | "votes" | "type";

interface MetaBadgesProps {
  media: Media;
  fields: MetaField[];
  className?: string;
}

/** Renders the requested metadata as badges, skipping unknown values. */
export function MetaBadges({ media, fields, className }: MetaBadgesProps) {
  const duration = formatDuration(media);

  const render: Record<MetaField, ReactNode> = {
    duration: duration && <Badge icon={Clock}>{duration}</Badge>,
    year: media.releaseYear && <Badge icon={CalendarDays}>{media.releaseYear}</Badge>,
    rating: media.rating > 0 && (
      <Badge icon={Star} iconClassName="fill-star text-star">
        <span className="sr-only">Rating </span>
        {formatRating(media.rating)}
      </Badge>
    ),
    votes: media.voteCount > 0 && (
      <Badge icon={Users}>
        {formatCompact(media.voteCount)}
        <span className="sr-only"> votes</span>
      </Badge>
    ),
    type: <Badge icon={media.type === "movie" ? Film : Tv}>{mediaTypeLabel(media)}</Badge>,
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {fields.map((field) => render[field] && <span key={field}>{render[field]}</span>)}
    </div>
  );
}
