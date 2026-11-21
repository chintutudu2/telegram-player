import "server-only";

// Import only from the package root: sub-path imports (e.g. "telegram/sessions")
// can't be resolved by Node for external packages, so Next would bundle a
// second copy whose classes GramJS doesn't recognise.
import { Logger, sessions, TelegramClient } from "telegram";
import type { LogLevel } from "telegram/extensions/Logger";
import type { PoolBot } from "./bot-picker";

export { pickBot } from "./bot-picker";

/**
 * MTProto connections (the protocol Telegram's own apps use), one per bot.
 * Unlike the Bot API it can read any byte range of a file of any size, so
 * videos stream straight from Telegram with nothing stored locally.
 *
 * Telegram limits how fast a single bot can download, so extra "helper"
 * bots (TELEGRAM_STREAM_BOT_TOKENS, each an admin of the channel) form a
 * pool: viewers are spread across bots, multiplying total bandwidth.
 *
 * Needs TELEGRAM_API_ID + TELEGRAM_API_HASH (my.telegram.org). Without them,
 * streaming falls back to the Bot API (20 MB limit).
 */

interface MtprotoConfig {
  apiId: number;
  apiHash: string;
  /** Main bot first, then helper bots. */
  botTokens: string[];
}

export function getMtprotoConfig(): MtprotoConfig | null {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH?.trim();
  const tokens = [process.env.TELEGRAM_BOT_TOKEN, ...(process.env.TELEGRAM_STREAM_BOT_TOKENS ?? "").split(",")]
    .map((token) => token?.trim())
    .filter((token): token is string => Boolean(token));
  const botTokens = [...new Set(tokens)];
  return Number.isSafeInteger(apiId) && apiId > 0 && apiHash && botTokens.length
    ? { apiId, apiHash, botTokens }
    : null;
}

export const isMtprotoConfigured = () => getMtprotoConfig() !== null;

export interface StreamBot extends PoolBot {
  client: Promise<TelegramClient>;
}

async function connect(config: MtprotoConfig, token: string, number: number): Promise<TelegramClient> {
  const client = new TelegramClient(new sessions.StringSession(""), config.apiId, config.apiHash, {
    connectionRetries: 5,
    floodSleepThreshold: 0, // never sleep silently: the stream layer fails over to another bot
    // GramJS logs transient handshake retries as errors; real failures are
    // reported by this module instead.
    baseLogger: new Logger("none" as LogLevel),
  });
  await client.start({ botAuthToken: token });
  console.info(`[mtproto] bot ${number} connected to Telegram`);
  return client;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One pool per server process, kept across dev hot reloads.
const POOL = Symbol.for("telegram-player.mtproto-pool");
type GlobalWithPool = typeof globalThis & { [POOL]?: StreamBot[] };

/** All bots, connecting lazily (in parallel) on first use. */
export function getBotPool(): StreamBot[] {
  const config = getMtprotoConfig();
  if (!config) throw new Error("TELEGRAM_API_ID / TELEGRAM_API_HASH are not set.");

  const store = globalThis as GlobalWithPool;
  store[POOL] ??= config.botTokens.map((token, index) => {
    const bot: StreamBot = { number: index + 1, client: Promise.resolve(null!), active: 0, coolingUntil: 0, unusable: null };
    // Log in one after another (~0.5 s apart): simultaneous handshakes
    // trip Telegram's "invalid new nonce hash" retries.
    bot.client = sleep(index * 500).then(() => connect(config, token, bot.number));
    bot.client.catch((error: Error) => markUnusable(bot, `login failed: ${error.message}`));
    return bot;
  });
  return store[POOL];
}

/** Starts logging in every bot without waiting, so the first viewer doesn't. */
export function warmUpStreaming() {
  if (isMtprotoConfigured()) getBotPool();
}

export function markUnusable(bot: StreamBot, reason: string) {
  if (bot.unusable) return;
  bot.unusable = reason;
  console.warn(`[mtproto] bot ${bot.number} disabled — ${reason}`);
}
