"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { useFavorites } from "@/hooks/useFavorites";
import type { Media } from "@/types/media";
import { cn } from "@/utils/cn";

interface FavoriteButtonProps {
  media: Media;
  /** Show a text label (detail views) instead of an icon-only control. */
  withLabel?: boolean;
  className?: string;
}

/** Renders nothing while `siteConfig.features.favorites` is off. */
export function FavoriteButton(props: FavoriteButtonProps) {
  return siteConfig.features.favorites ? <FavoriteToggle {...props} /> : null;
}

function FavoriteToggle({ media, withLabel, className }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(media);
  const label = active ? "Remove from favorites" : "Add to favorites";

  return (
    <Button
      variant="glass"
      size={withLabel ? "lg" : "icon"}
      aria-pressed={active}
      aria-label={withLabel ? undefined : `${label}: ${media.title}`}
      title={label}
      onClick={() => toggleFavorite(media)}
      className={cn(!withLabel && "size-9 bg-black/35", className)}
    >
      <Heart
        aria-hidden
        className={cn("size-[18px] transition-colors", active && "fill-danger text-danger")}
      />
      {withLabel && (active ? "Saved" : "Favorite")}
    </Button>
  );
}
