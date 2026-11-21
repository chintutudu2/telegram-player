/** Pool bookkeeping for streaming bots. Dependency-free so it can be unit tested. */

export interface PoolBot {
  /** 1-based position in the pool, for logs and the X-Stream-Bot header. */
  number: number;
  /** Viewers currently streaming through this bot. */
  active: number;
  /** Rate-limited by Telegram until this time (ms epoch). */
  coolingUntil: number;
  /** Set when the bot can't be used (bad token, not in the channel…). */
  unusable: string | null;
}

/**
 * Least-busy bot that isn't rate-limited (ties → lowest number). If every
 * usable bot is cooling down, returns the one that recovers first.
 */
export function pickBot<T extends PoolBot>(pool: T[], now = Date.now(), exclude?: T): T | null {
  const usable = pool.filter((bot) => !bot.unusable && bot !== exclude);
  if (usable.length === 0) return null;
  const ready = usable.filter((bot) => bot.coolingUntil <= now);
  const candidates = ready.length ? ready : [...usable].sort((a, b) => a.coolingUntil - b.coolingUntil).slice(0, 1);
  return candidates.reduce((best, bot) => (bot.active < best.active ? bot : best));
}
