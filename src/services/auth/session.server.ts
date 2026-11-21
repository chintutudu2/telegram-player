import "server-only";

import { cookies } from "next/headers";
import {
  createSessionToken,
  getAuthSecret,
  SESSION_COOKIE,
  type SessionClaims,
  sessionCookieOptions,
  verifySessionToken,
} from "./session.token";
import { type AppUser, isAdminEmail } from "./users.repository";

/** The signed-in viewer for this request, or null. Re-verify in every action. */
export async function getSession(): Promise<SessionClaims | null> {
  const secret = getAuthSecret();
  if (!secret) return null;
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret);
}

/** Session claims for a user record, as a cookie value. */
export function sessionFor(user: Pick<AppUser, "uid" | "email" | "status">) {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set (32+ characters).");
  return createSessionToken(
    { uid: user.uid, email: user.email, status: user.status, admin: isAdminEmail(user.email) },
    secret,
  );
}

/** Sets the session cookie (Server Actions only). */
export async function startSession(user: Pick<AppUser, "uid" | "email" | "status">): Promise<SessionClaims> {
  const { token, claims } = sessionFor(user);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  return claims;
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
