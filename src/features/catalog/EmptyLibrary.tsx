import { Send } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";

/** "No data" screen when the Firestore library has nothing for a view yet. */
export function EmptyLibrary({ kind = "titles" }: { kind?: "titles" | "movies" | "series" }) {
  const example =
    kind === "series" ? "Show Name | Series | Drama | 45m | S01E01" : "Movie Title | Movie | Action | 2h 15m";

  return (
    <EmptyState
      icon={Send}
      title={`No ${kind} yet`}
      description="Add documents to the Firestore media collection, or post a video to your Telegram channel with a caption like this and run a sync."
    >
      <code className="rounded-xl bg-black/30 px-4 py-2 text-sm text-accent">{example}</code>
    </EmptyState>
  );
}
