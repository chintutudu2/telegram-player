/** Uniform JSON envelope shared by route handlers and browser clients. */
export type ApiResponse<T> = { data: T } | { error: { message: string } };

/** Browser-side reader for `/api/*` envelopes; throws on `{ error }`. */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body || "error" in body) {
    const message = body && "error" in body ? body.error.message : undefined;
    throw new Error(message ?? `Request failed (${response.status})`);
  }
  return body.data;
}
