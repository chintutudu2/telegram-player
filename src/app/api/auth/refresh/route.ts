import type { NextRequest } from "next/server";
import { relativeRedirect } from "@/services/auth/redirect";
import { sessionFor } from "@/services/auth/session.server";
import {
  getAuthSecret,
  SESSION_COOKIE,
  safeNextPath,
  sessionCookieOptions,
  verifySessionToken,
} from "@/services/auth/session.token";
import { getUser, isAdminEmail } from "@/services/auth/users.repository";

/**
 * `proxy.ts` sends page loads here when the session's approval status is due
 * for a re-check. Reads `users/{uid}`, re-issues the cookie, and continues to
 * `next` (or /pending, or /login if the account record is gone).
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const secret = getAuthSecret();
  const claims = secret ? verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;

  if (!claims) {
    const response = relativeRedirect(`/login?next=${encodeURIComponent(next)}`);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  let status = claims.status;
  try {
    const user = await getUser(claims.uid);
    if (!user) {
      const response = relativeRedirect("/login");
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    // Admin emails stay approved even if their record was edited by hand.
    status = isAdminEmail(user.email) ? "approved" : user.status;
  } catch (error) {
    // Firestore unreachable: keep the current status (and re-stamp it, so
    // proxy doesn't loop back here) rather than locking everyone out.
    console.error("[auth] status re-check failed", error);
  }

  const { token } = sessionFor({ uid: claims.uid, email: claims.email, status });
  const response = relativeRedirect(status === "approved" ? next : "/pending");
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
