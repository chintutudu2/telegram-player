import type { ReactNode } from "react";
import { UserMenu } from "@/features/auth/UserMenu";
import { MediaDetailProvider } from "@/features/media-detail/MediaDetailProvider";
import { isTmdbConfigured } from "@/services/tmdb/tmdb.client";
import { Header } from "./Header";
import { TmdbCredit } from "./TmdbCredit";

/** Signed-in chrome: top bar, page content, TMDB credit and the media-detail modal. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MediaDetailProvider>
      <div className="flex min-h-dvh min-w-0 flex-col">
        <Header profile={<UserMenu />} />
        <main id="main" className="flex-1 space-y-12 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
          {children}
        </main>
        {isTmdbConfigured() && (
          <footer className="border-t border-white/5 px-4 py-6 sm:px-6 lg:px-8">
            <TmdbCredit />
          </footer>
        )}
      </div>
    </MediaDetailProvider>
  );
}
