import "server-only";

import { isTmdbConfigured } from "@/services/tmdb/tmdb.client";
import { tmdbProvider } from "@/services/tmdb/tmdb.provider";
import { type LibraryType, type TmdbEnrichment, tmdbLookupKey } from "./media.schema";
import { listEnrichmentCandidates, setTmdbEnrichment } from "./media.writer";

/**
 * Looks a title up on TMDB. Resolves to `found: false` when there is no
 * match (cached, not retried until the title/year changes) and throws on
 * network/API errors (left unset, so the next sync retries).
 */
export async function lookupTmdb(title: string, type: LibraryType, year: number | null): Promise<TmdbEnrichment> {
  const lookup = tmdbLookupKey(title, type, year);
  const results = await tmdbProvider.search(title, type === "movie" ? "movie" : "tv");
  const match = (year && results.find((r) => r.releaseYear === year)) || results[0];
  if (!match) return { lookup, found: false };

  return {
    lookup,
    found: true,
    tmdbId: Number(match.sourceId),
    overview: match.overview,
    posterUrl: match.posterUrl,
    backdropUrl: match.backdropUrl,
    rating: match.rating,
    voteCount: match.voteCount,
    genres: match.genres,
    releaseYear: match.releaseYear,
  };
}

export interface EnrichmentReport {
  enabled: boolean;
  enriched: string[];
  notFound: string[];
  failed: string[];
  /** Candidates left for the next sync (batch limit reached). */
  remaining: number;
}

const BATCH_LIMIT = 40;

/**
 * Backfills TMDB metadata for documents that have none or whose title/year
 * changed since the last lookup — covers uploads synced before a TMDB key
 * was added and documents typed into the Firebase console.
 */
export async function enrichMissing(): Promise<EnrichmentReport> {
  const report: EnrichmentReport = { enabled: isTmdbConfigured(), enriched: [], notFound: [], failed: [], remaining: 0 };
  if (!report.enabled) return report;

  const candidates = await listEnrichmentCandidates();
  // Series episodes share one lookup, so group before calling TMDB.
  const groups = Map.groupBy(candidates, (c) => c.lookup);
  const batch = [...groups.values()].slice(0, BATCH_LIMIT);
  report.remaining = Math.max(0, groups.size - batch.length);

  for (const docs of batch) {
    const { title, type, releaseYear } = docs[0];
    try {
      const tmdb = await lookupTmdb(title, type, releaseYear);
      await Promise.all(docs.map((doc) => setTmdbEnrichment(doc.id, tmdb)));
      (tmdb.found ? report.enriched : report.notFound).push(title);
    } catch (error) {
      console.warn(`[enrichment] TMDB lookup failed for "${title}"`, error);
      report.failed.push(title);
    }
  }
  return report;
}
