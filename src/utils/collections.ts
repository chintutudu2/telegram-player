/** Alternates items from two lists: [a1, b1, a2, b2, …, remaining]. */
export function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const result: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) result.push(a[i]);
    if (i < b.length) result.push(b[i]);
  }
  return result;
}

/** Removes duplicates by key, keeping the first occurrence. */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Distinct values across nested arrays, ordered by frequency (desc). */
export function rankByFrequency(groups: readonly (readonly string[])[]): string[] {
  const counts = new Map<string, number>();
  for (const value of groups.flat()) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([value]) => value);
}
