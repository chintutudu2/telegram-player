import { createHash, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { redirectTo } from "@/services/auth/redirect";
import {
  getAuthSecret,
  isStale,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/services/auth/session.token";

/**
 * Access gate for the whole app: only approved accounts get past this point.
 * The signed session cookie is checked without any I/O (it runs on every video
 * range request); page loads detour through /api/auth/refresh every so often
 * to re-read the approval status from Firestore.
 *
 * Server Actions and route handlers that change data re-check the session
 * themselves (see services/auth/auth.actions.ts).
 */

/** Reachable without a session. Telegram endpoints check their own secret. */
const PUBLIC_PREFIXES = ["/login", "/api/auth/", "/api/telegram/"];
/** Reachable while waiting for approval (or after being declined). */
const UNAPPROVED_PATHS = ["/pending"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));

const isApi = (path: string) => path.startsWith("/api/");

/** A top-level page load (not an RSC fetch, prefetch, media or API request). */
const isDocumentLoad = (request: NextRequest) => {
  if (request.method !== "GET") return false;
  const dest = request.headers.get("sec-fetch-dest");
  return dest ? dest === "document" : (request.headers.get("accept") ?? "").includes("text/html");
};

/** Server-side tools (load test) may use `Authorization: Bearer $TELEGRAM_SYNC_SECRET`. */
function hasServiceToken(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_SYNC_SECRET?.trim();
  const given = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || !given) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

const withNext = (path: string, request: NextRequest) =>
  `${path}?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const secret = getAuthSecret();

  if (!secret) {
    return new NextResponse("Sign-in is not configured: set AUTH_SECRET (32+ characters) and restart.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);

  if (startsWithAny(path, PUBLIC_PREFIXES)) {
    // Already signed in and approved: skip the sign-in form.
    if (path === "/login" && session?.status === "approved" && isDocumentLoad(request)) return redirectTo(request, "/");
    return NextResponse.next();
  }

  if (isApi(path) && hasServiceToken(request)) return NextResponse.next();

  if (!session) {
    if (isApi(path)) return Response.json({ error: { message: "Sign in required." } }, { status: 401 });
    const response = redirectTo(request, withNext("/login", request));
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE); // expired/forged
    return response;
  }

  if (isDocumentLoad(request) && isStale(session)) {
    return redirectTo(request, withNext("/api/auth/refresh", request));
  }

  if (session.status !== "approved") {
    if (startsWithAny(path, UNAPPROVED_PATHS)) return NextResponse.next();
    if (isApi(path)) return Response.json({ error: { message: "Waiting for approval." } }, { status: 403 });
    return redirectTo(request, "/pending");
  }

  if (startsWithAny(path, UNAPPROVED_PATHS) && isDocumentLoad(request)) return redirectTo(request, "/");
  if (startsWithAny(path, ["/admin"]) && !session.admin) {
    return isApi(path) ? Response.json({ error: { message: "Forbidden." } }, { status: 403 }) : redirectTo(request, "/");
  }

  return NextResponse.next();
}

export const config = {
  // Everything except build assets and files from public/.
  matcher: ["/((?!_next/static|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)"],
};
