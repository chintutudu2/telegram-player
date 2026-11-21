import { LoaderCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getMediaDetails } from "@/services/media/catalog.service";
import { parseMediaId } from "@/types/media";
import { WatchPlayer } from "./WatchPlayer";

/** Resolves a `/watch/[id]` param to full details, or 404s. */
export async function loadWatchDetails(id: string) {
  const ref = parseMediaId(id);
  const details = ref && (await getMediaDetails(ref.type, ref.sourceId));
  if (!details) notFound();
  return details;
}

interface WatchViewProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function WatchView({ params, searchParams }: WatchViewProps) {
  const { id } = await params;
  const { episode } = await searchParams;
  const details = await loadWatchDetails(id);

  return (
    <WatchPlayer
      media={details}
      initialEpisodeId={typeof episode === "string" ? episode : undefined}
      backHref={details.type === "movie" ? "/movies" : "/series"}
    />
  );
}

export function WatchSkeleton() {
  return (
    <div role="status" aria-label="Loading player" className="grid size-full place-items-center">
      <LoaderCircle className="size-10 animate-spin text-accent" aria-hidden />
    </div>
  );
}
