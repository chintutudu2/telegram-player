import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TmdbCredit } from "@/components/layout/TmdbCredit";
import { isTmdbConfigured } from "@/services/tmdb/tmdb.client";

/** Every signed-in page: sidebar, header and the media-detail modal. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell sidebarFooter={isTmdbConfigured() ? <TmdbCredit /> : null}>{children}</AppShell>;
}
