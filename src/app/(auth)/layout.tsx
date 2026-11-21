import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

/** Sign-in and approval screens: a centred card, no app chrome. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        {children}
      </div>
    </main>
  );
}
