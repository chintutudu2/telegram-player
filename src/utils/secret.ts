import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (hashing equalises lengths). */
export function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Reads `Authorization: Bearer <token>`. */
export const bearerToken = (request: Request) =>
  request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
