import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { UserList } from "@/features/auth/UserList";
import { getSession } from "@/services/auth/session.server";
import { listUsers } from "@/services/auth/users.repository";

export const metadata: Metadata = { title: "Viewers" };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Viewers" description="Approve who can watch. Changes apply within 15 minutes." />
        <SignOutButton />
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Viewers />
      </Suspense>
    </div>
  );
}

async function Viewers() {
  const session = await getSession();
  if (!session?.admin || session.status !== "approved") redirect("/");
  return <UserList users={await listUsers()} currentUid={session.uid} />;
}
