import { Hourglass, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/feedback";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { getSession } from "@/services/auth/session.server";

export const metadata: Metadata = { title: "Waiting for approval" };

export default function PendingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <PendingStatus />
    </Suspense>
  );
}

async function PendingStatus() {
  const session = await getSession();
  const declined = session?.status === "rejected";
  const Icon = declined ? ShieldX : Hourglass;

  return (
    <section className="glass flex flex-col items-center gap-5 rounded-3xl px-6 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-accent/10 text-accent shadow-glow">
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-fg">{declined ? "Access not granted" : "Waiting for approval"}</h1>
        <p className="text-sm text-muted">
          {declined
            ? "The owner hasn’t approved this account. Ask them if you think that’s a mistake."
            : "Your account is set up. You can start watching as soon as the owner approves it."}
        </p>
        {session?.email && <p className="text-sm text-muted/80">Signed in as {session.email}</p>}
      </div>
      {!declined && (
        // A full page load re-checks the approval status (see proxy.ts).
        // eslint-disable-next-line @next/next/no-html-link-for-pages -- needs a real page load
        <a href="/" className={buttonStyles({ variant: "primary" })}>
          Check again
        </a>
      )}
      <SignOutButton />
    </section>
  );
}
