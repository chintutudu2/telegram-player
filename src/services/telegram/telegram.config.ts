import "server-only";

export interface TelegramConfig {
  botToken: string;
  /** Bot API base URL (overridable for tests). */
  apiBase: string;
  /** Chats allowed to publish into the library (channel id + admin DMs). */
  allowedChatIds: Set<number>;
  /** Shared secret for the webhook header and the sync endpoint. */
  syncSecret: string | null;
}

const ids = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isSafeInteger(id) && id !== 0);

export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return null;

  return {
    botToken,
    apiBase: (process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org").replace(/\/$/, ""),
    allowedChatIds: new Set([
      ...ids(process.env.TELEGRAM_CHANNEL_ID),
      ...ids(process.env.TELEGRAM_ADMIN_IDS),
    ]),
    syncSecret: process.env.TELEGRAM_SYNC_SECRET?.trim() || null,
  };
}
