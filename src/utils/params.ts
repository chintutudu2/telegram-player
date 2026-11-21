/** Narrows an untrusted string to one of the allowed literals, or `null`. */
export function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

/** Accepts provider ids (numeric TMDB ids, Firestore doc ids, slugs). */
export function safeId(value: string | null | undefined): string | null {
  return value && /^[\w-]{1,128}$/.test(value) ? value : null;
}

/** Telegram `file_id`s are URL-safe base64-ish tokens. */
export function telegramFileId(value: string | null | undefined): string | null {
  return value && /^[\w-]{10,256}$/.test(value) ? value : null;
}
