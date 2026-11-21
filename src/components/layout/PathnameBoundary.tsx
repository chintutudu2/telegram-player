"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";

type RenderWithPath = (pathname: string) => ReactNode;

function PathnameReader({ children }: { children: RenderWithPath }) {
  return children(usePathname());
}

/**
 * With Cache Components, `usePathname` suspends on routes whose params are
 * only known at request time (e.g. `/watch/[id]`). Shell widgets render
 * through this boundary so those routes still prerender: the fallback uses
 * a neutral path, and the real one streams in at request time. On static
 * routes the pathname resolves during prerendering and the fallback is
 * never shown.
 */
export function PathnameBoundary({ children }: { children: RenderWithPath }) {
  return (
    <Suspense fallback={children("")}>
      <PathnameReader>{children}</PathnameReader>
    </Suspense>
  );
}
