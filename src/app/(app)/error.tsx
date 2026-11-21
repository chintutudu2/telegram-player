"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/feedback";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description="We couldn’t load this section. Please try again."
    >
      <Button variant="primary" onClick={retry}>
        Try again
      </Button>
    </EmptyState>
  );
}
