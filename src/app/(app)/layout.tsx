import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/** Every signed-in page: top bar, footer and the media-detail modal. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
