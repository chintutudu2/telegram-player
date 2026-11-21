/**
 * Parses upload captions into library metadata. Dependency-free so it can
 * be unit tested in isolation.
 *
 *   Title | Movie | Action | 2h 15m
 *   Title (2021) | Series | Drama | 45m | S01E02 | Episode title
 *
 * Only title and type are required; the remaining fields may appear in any
 * order after the type. The first caption line containing `|` is used.
 */

export interface ParsedCaption {
  title: string;
  type: "movie" | "series";
  category: string;
  releaseYear: number | null;
  durationSeconds: number | null;
  season: number | null;
  episode: number | null;
  episodeTitle: string | null;
}

export type CaptionResult = { ok: true; value: ParsedCaption } | { ok: false; reason: string };

const TYPE_ALIASES: Record<string, ParsedCaption["type"]> = {
  movie: "movie",
  film: "movie",
  series: "series",
  tv: "series",
  show: "series",
  episode: "series",
};

const DURATION_RE = /^(?:(\d{1,2})\s*h(?:ours?|rs?)?)?\s*(?:(\d{1,3})\s*m(?:in(?:utes?)?)?)?$/i;
const EPISODE_RE = /^S(\d{1,2})\s*E(\d{1,3})$/i;
const YEAR_RE = /\s*\((\d{4})\)\s*$/;

/** "2h 15m" → 8100; "45 min" → 2700; anything else → null. */
export function parseDuration(text: string): number | null {
  const match = DURATION_RE.exec(text.trim());
  if (!match || (!match[1] && !match[2])) return null;
  return (Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * 60;
}

/** 8100 → "2h 15m"; 2700 → "45m". */
export function formatDurationSeconds(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, (m || !h) && `${m}m`].filter(Boolean).join(" ");
}

const titleCase = (text: string) =>
  text.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (char) => char.toUpperCase());

export function parseCaption(caption: string | undefined): CaptionResult {
  const line = caption?.split(/\r?\n/).find((l) => l.includes("|"));
  if (!line) return { ok: false, reason: "caption has no `Title | Type | …` line" };

  const [rawTitle = "", rawType = "", ...rest] = line.split("|").map((part) => part.trim());
  const type = TYPE_ALIASES[rawType.toLowerCase()];
  if (!rawTitle) return { ok: false, reason: "missing title" };
  if (!type) return { ok: false, reason: `unknown type "${rawType}" (use Movie or Series)` };

  const yearMatch = YEAR_RE.exec(rawTitle);
  const parsed: ParsedCaption = {
    title: rawTitle.replace(YEAR_RE, "").trim(),
    type,
    category: "Uncategorized",
    releaseYear: yearMatch ? Number(yearMatch[1]) : null,
    durationSeconds: null,
    season: null,
    episode: null,
    episodeTitle: null,
  };

  let categorySet = false;
  for (const field of rest.filter(Boolean)) {
    const episode = EPISODE_RE.exec(field);
    const duration = parseDuration(field);
    if (episode) {
      parsed.season = Number(episode[1]);
      parsed.episode = Number(episode[2]);
    } else if (duration !== null) {
      parsed.durationSeconds = duration;
    } else if (!categorySet) {
      parsed.category = titleCase(field);
      categorySet = true;
    } else if (type === "series" && !parsed.episodeTitle) {
      parsed.episodeTitle = field;
    }
  }

  return { ok: true, value: parsed };
}

/** URL-safe series key; falls back to a hash for non-Latin titles. */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (slug) return slug;

  let hash = 0x811c9dc5; // FNV-1a
  for (const char of text) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `s-${hash.toString(36)}`;
}
