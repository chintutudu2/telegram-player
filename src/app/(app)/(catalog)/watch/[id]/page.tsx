import type { Metadata } from "next";
import { Suspense } from "react";
import { loadWatchDetails, WatchSkeleton, WatchView } from "@/features/watch/WatchView";

export async function generateMetadata({ params }: PageProps<"/watch/[id]">): Promise<Metadata> {
  const details = await loadWatchDetails((await params).id);
  return { title: `Watch ${details.title}`, description: details.overview || undefined };
}

export default function WatchPage({ params, searchParams }: PageProps<"/watch/[id]">) {
  return (
    <Suspense fallback={<WatchSkeleton />}>
      <WatchView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
