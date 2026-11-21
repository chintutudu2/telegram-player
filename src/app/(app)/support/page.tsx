import { Headphones } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Support" description="Help with playback, accounts and billing." />
      <EmptyState
        icon={Headphones}
        title="Need a hand?"
        description="The help center is being set up. Check back soon for guides and live chat."
      />
    </>
  );
}
