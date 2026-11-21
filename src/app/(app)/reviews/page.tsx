import { MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Customer Reviews" };

export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="Customer Reviews" description="What viewers are saying." />
      <EmptyState
        icon={MessageSquareText}
        title="Reviews are on the way"
        description="Community reviews will be stored in Firestore and shown here."
      />
    </>
  );
}
