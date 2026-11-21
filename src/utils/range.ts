export type ByteRange = { start: number; end: number };

/**
 * Parses a single-range `Range: bytes=…` header against a known size.
 * Returns `null` to serve the full body (absent/multi-range headers) and
 * `"unsatisfiable"` for ranges outside the file (→ 416).
 */
export function parseRange(header: string | null, size: number): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return "unsatisfiable";

  let start: number;
  let end: number;
  if (!rawStart) {
    // Suffix range: last N bytes.
    start = Math.max(0, size - Number(rawEnd));
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }
  return start > end || start >= size ? "unsatisfiable" : { start, end };
}
