import { Skeleton } from "@/components/ui/feedback";

/** Suspense fallback mirroring the hero → pills → cards layout. */
export function CatalogSkeleton() {
  return (
    <div role="status" aria-label="Loading catalog" className="space-y-10">
      <Skeleton className="h-[340px] rounded-[2rem] sm:h-[380px] lg:h-[460px]" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="aspect-4/5" />
        ))}
      </div>
    </div>
  );
}
