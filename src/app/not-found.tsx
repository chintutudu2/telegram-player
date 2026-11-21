import { SearchX } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/feedback";

// Unmatched URLs render under the root layout only, so add the app chrome here.
export default function NotFound() {
  return (
    <AppShell>
      <EmptyState icon={SearchX} title="Page not found" description="This page doesn’t exist or has moved.">
        <ButtonLink href="/" variant="primary">
          Back to home
        </ButtonLink>
      </EmptyState>
    </AppShell>
  );
}
