import "server-only";

// Overridable for tests or a caching proxy.
const API_BASE = (process.env.TMDB_API_BASE?.trim() || "https://api.themoviedb.org/3").replace(/\/+$/, "");
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type TmdbImageSize = "w342" | "w500" | "w780" | "w1280" | "original";

type QueryParams = Record<string, string | number | undefined>;

function credentials() {
  return {
    token: process.env.TMDB_ACCESS_TOKEN?.trim(),
    apiKey: process.env.TMDB_API_KEY?.trim(),
  };
}

export function isTmdbConfigured(): boolean {
  const { token, apiKey } = credentials();
  return Boolean(token || apiKey);
}

export class TmdbError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`TMDB request failed (${status}) for ${path}`);
    this.name = "TmdbError";
  }
}

/** Thin authenticated GET wrapper. Credentials never leave the server. */
export async function tmdbFetch<T>(path: string, params: QueryParams = {}): Promise<T> {
  const { token, apiKey } = credentials();
  const url = new URL(`${API_BASE}${path}`);

  for (const [key, value] of Object.entries({ language: "en-US", ...params })) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  if (!token && apiKey) url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new TmdbError(response.status, path);
  return response.json() as Promise<T>;
}

/** Resolves a TMDB image path. Absolute URLs pass through unchanged. */
export function tmdbImageUrl(path: string | null | undefined, size: TmdbImageSize): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${IMAGE_BASE}/${size}${path}`;
}
