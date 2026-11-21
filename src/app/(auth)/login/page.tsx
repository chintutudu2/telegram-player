import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    // The form reads ?next= on the client, so the card itself stays static.
    <Suspense fallback={<Skeleton className="h-96" />}>
      <LoginForm />
    </Suspense>
  );
}
