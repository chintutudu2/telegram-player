"use client";

import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { type AuthFormState, authenticate, requestPasswordReset } from "@/services/auth/auth.actions";
import { cn } from "@/utils/cn";

type Mode = "signin" | "signup" | "reset";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  signin: { title: "Welcome back", subtitle: "Sign in to keep watching.", submit: "Sign in" },
  signup: {
    title: "Request access",
    subtitle: "Create an account. You can watch as soon as the owner approves it.",
    submit: "Create account",
  },
  reset: { title: "Reset password", subtitle: "We’ll email you a link to choose a new one.", submit: "Send reset link" },
};

const inputClass =
  "h-11 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-fg placeholder:text-muted/60 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [mode, setMode] = useState<Mode>("signin");
  const [authState, authAction, authPending] = useActionState<AuthFormState, FormData>(authenticate, {});
  const [resetState, resetAction, resetPending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  const state = mode === "reset" ? resetState : authState;
  const pending = mode === "reset" ? resetPending : authPending;
  const copy = COPY[mode];

  return (
    <section className="glass space-y-6 rounded-3xl p-6 sm:p-8">
      <header className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold text-fg">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.subtitle}</p>
      </header>

      <form action={mode === "reset" ? resetAction : authAction} className="space-y-4">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />

        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.email}
            key={`email-${mode}`}
            className={inputClass}
          />
        </label>

        {mode !== "reset" && (
          <label className="block space-y-1.5">
            <span className="text-sm text-muted">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={inputClass}
            />
          </label>
        )}

        {mode === "signup" && (
          <label className="block space-y-1.5">
            <span className="text-sm text-muted">Confirm password</span>
            <input name="confirm" type="password" required minLength={6} autoComplete="new-password" className={inputClass} />
          </label>
        )}

        {(state.error || state.notice) && (
          <p
            role={state.error ? "alert" : "status"}
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm",
              state.error ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent",
            )}
          >
            {state.error ?? state.notice}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={pending} className="w-full justify-center">
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {copy.submit}
        </Button>
      </form>

      <nav className="flex flex-col items-center gap-2 text-sm text-muted">
        {mode === "signin" && (
          <>
            <ModeLink onClick={() => setMode("reset")}>Forgot password?</ModeLink>
            <p>
              New here? <ModeLink onClick={() => setMode("signup")}>Request access</ModeLink>
            </p>
          </>
        )}
        {mode !== "signin" && (
          <p>
            Already have an account? <ModeLink onClick={() => setMode("signin")}>Sign in</ModeLink>
          </p>
        )}
      </nav>
    </section>
  );
}

function ModeLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer font-medium text-accent hover:underline">
      {children}
    </button>
  );
}
