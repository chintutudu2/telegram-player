import type { ReactNode } from "react";
import { WatchFrame } from "@/features/watch/WatchFrame";

/**
 * Full-screen stage around the player. As a layout it also wraps the loading
 * state, and it isn't remounted when only the `?episode=` param changes.
 */
export default function WatchLayout({ children }: { children: ReactNode }) {
  return <WatchFrame>{children}</WatchFrame>;
}
