import { DatabaseZap } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

/** Shown on catalog routes until the Firebase web config is provided. */
export function FirebaseNotConfigured() {
  return (
    <EmptyState
      icon={DatabaseZap}
      title="Firebase not configured"
      description="Add your Firebase web app config to .env.local (see .env.example), then restart the app to load your catalog."
    >
      <ul className="space-y-1 rounded-2xl bg-black/30 px-5 py-3 text-left font-mono text-xs text-accent sm:text-sm">
        {REQUIRED_KEYS.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
    </EmptyState>
  );
}
