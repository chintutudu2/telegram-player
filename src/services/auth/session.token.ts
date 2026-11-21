import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless session cookie: base64url(JSON claims) + "." + HMAC-SHA256.
 * Verifying it needs no network or database, so `proxy.ts` can check every
 * request (including each video range request) for free. The approval status
 * inside is re-read from Firestore periodically (see `isStale`).
 */

export const SESSION_COOKIE = "tp_session";
/** Cookie and token lifetime; refreshed whenever the status is re-checked. */
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

export type AccessStatus = "pending" | "approved" | "rejected";

export interface SessionClaims {
  uid: string;
  email: string;
  status: AccessStatus;
  admin: boolean;
  /** When the status was last read from Firestore (unix seconds). */
  checkedAt: number;
  /** Expiry (unix seconds). */
  exp: number;
}

/** How long a status may be trusted before a page load re-reads it. */
const RECHECK_AFTER_S: Record<AccessStatus, number> = {
  approved: 15 * 60, // a revoked viewer loses access within 15 minutes
  pending: 10, // approval shows up on the next reload
  rejected: 10,
};

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function createSessionToken(
  claims: Omit<SessionClaims, "checkedAt" | "exp">,
  secret: string,
): { token: string; claims: SessionClaims } {
  const checkedAt = nowSeconds();
  const full: SessionClaims = { ...claims, checkedAt, exp: checkedAt + SESSION_MAX_AGE_S };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return { token: `${payload}.${sign(payload, secret)}`, claims: full };
}

/** Returns the claims if the signature is valid and the token hasn't expired. */
export function verifySessionToken(token: string | undefined, secret: string): SessionClaims | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (typeof claims.uid !== "string" || typeof claims.exp !== "number") return null;
    return claims.exp > nowSeconds() ? claims : null;
  } catch {
    return null;
  }
}

export const isStale = (claims: SessionClaims) =>
  nowSeconds() - claims.checkedAt > (RECHECK_AFTER_S[claims.status] ?? 0);

/** Only same-site paths, so `?next=` can't redirect off the site. */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
