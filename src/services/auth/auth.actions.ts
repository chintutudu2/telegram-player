"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, firebaseAuth } from "./firebase-auth.rest";
import { notifyAdminsOfSignUp } from "./notify";
import { endSession, getSession, startSession } from "./session.server";
import { type AccessStatus, safeNextPath } from "./session.token";
import { ensureUser, setUserStatus } from "./users.repository";

export interface AuthFormState {
  error?: string;
  notice?: string;
  email?: string;
}

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/** Sign in or create an account (form field `mode`), then start a session. */
export async function authenticate(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const mode = field(form, "mode");
  const email = field(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(field(form, "next"));

  if (!email || !password) return { error: "Enter your email and password.", email };
  if (mode === "signup" && password !== String(form.get("confirm") ?? "")) {
    return { error: "The passwords don’t match.", email };
  }

  let status: AccessStatus;
  try {
    const account =
      mode === "signup" ? await firebaseAuth.signUp(email, password) : await firebaseAuth.signIn(email, password);
    const { user, created } = await ensureUser(account.uid, account.email);
    if (created) await notifyAdminsOfSignUp(user.email).catch(() => {});
    status = (await startSession(user)).status;
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message, email };
    console.error("[auth]", error);
    return { error: "Something went wrong. Try again.", email };
  }

  redirect(status === "approved" ? next : "/pending");
}

export async function requestPasswordReset(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = field(form, "email").toLowerCase();
  if (!email) return { error: "Enter your email first.", email };
  try {
    await firebaseAuth.sendPasswordReset(email);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message, email };
    throw error;
  }
  return { notice: "If that account exists, a reset link is on its way. Check your inbox.", email };
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/login");
}

/** Admin only: approve, decline or revoke a viewer. */
export async function setAccess(form: FormData): Promise<void> {
  const session = await getSession();
  if (!session?.admin || session.status !== "approved") redirect("/login");

  const uid = field(form, "uid");
  const status = field(form, "status");
  if (!uid || uid === session.uid) return; // admins can't lock themselves out
  if (status !== "approved" && status !== "rejected" && status !== "pending") return;

  await setUserStatus(uid, status);
  refresh();
}
