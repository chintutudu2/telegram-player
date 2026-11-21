import { Clapperboard, Tv } from "lucide-react";
import type { Media } from "@/types/media";
import { cn } from "@/utils/cn";
import { formatDuration } from "@/utils/format";

// Teal-family gradients so a row of art-less titles doesn't look identical.
const BACKDROPS = [
  "from-[#0f5c66] via-[#0d3439] to-ink",
  "from-[#0a6d78] via-[#0b2f35] to-ink",
  "from-[#13505e] via-[#10303a] to-ink",
  "from-[#0c4a52] via-[#122c33] to-ink",
];

const pick = (text: string) =>
  BACKDROPS[[...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7) % BACKDROPS.length];

/** Typographic poster for titles without artwork: name plus key details. */
export function TitlePoster({ media }: { media: Media }) {
  const Icon = media.type === "movie" ? Clapperboard : Tv;
  const details = [media.genres[0], media.releaseYear, formatDuration(media)].filter(Boolean).join(" · ");

  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 flex flex-col justify-center gap-3 bg-linear-to-br px-4 pt-10 pb-12", pick(media.title))}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-accent/10 blur-2xl" />
      <Icon className="size-6 text-accent/70" />
      <p className="line-clamp-4 text-xl leading-tight font-semibold text-white sm:text-2xl">{media.title}</p>
      {details && <p className="text-xs text-white/70 sm:text-sm">{details}</p>}
    </div>
  );
}
