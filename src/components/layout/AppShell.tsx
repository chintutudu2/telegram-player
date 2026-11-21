"use client";

import { type ReactNode, useCallback, useState } from "react";
import { MediaDetailProvider } from "@/features/media-detail/MediaDetailProvider";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
  /** Rendered at the bottom of the sidebar. */
  sidebarFooter?: ReactNode;
}

export function AppShell({ children, sidebarFooter }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <MediaDetailProvider>
      <Sidebar open={drawerOpen} onClose={closeDrawer} footer={sidebarFooter} />
      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-72 xl:pl-80">
        <Header onMenuClick={() => setDrawerOpen(true)} />
        <main id="main" className="flex-1 space-y-12 px-4 pt-4 pb-16 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </MediaDetailProvider>
  );
}
