import { MonitorPlay } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Your Videos" };

export default function VideosPage() {
  return (
    <>
      <PageHeader title="Your Videos" description="Media streamed from your connected Telegram sources." />
      <EmptyState
        icon={MonitorPlay}
        title="No library connected"
        description="Once a Telegram bot or channel is linked, your uploaded videos will appear here."
      />
    </>
  );
}
