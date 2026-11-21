import "server-only";

import type { TelegramConfig } from "./telegram.config";
import type { TelegramFile, TelegramResponse, TelegramUpdate } from "./telegram.types";

/**
 * Minimal Bot API client. URLs embed the bot token, so they are built here
 * and never logged, returned, or placed in error messages.
 */

export class TelegramApiError extends Error {
  constructor(
    readonly code: number,
    description: string,
  ) {
    super(`Telegram API error ${code}: ${description}`);
    this.name = "TelegramApiError";
  }
}

async function call<T>(config: TelegramConfig, method: string, params: object = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}/bot${config.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Network errors can echo the URL (and token); replace them wholesale.
    throw new TelegramApiError(503, `network error calling ${method}`);
  }

  const body = (await response.json().catch(() => null)) as TelegramResponse<T> | null;
  if (!body) throw new TelegramApiError(response.status, `invalid response from ${method}`);
  if (!body.ok) throw new TelegramApiError(body.error_code, body.description);
  return body.result;
}

export const telegramApi = {
  getUpdates: (config: TelegramConfig, offset?: number) =>
    call<TelegramUpdate[]>(config, "getUpdates", {
      offset,
      limit: 100,
      timeout: 0,
      allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"],
    }),

  sendMessage: (config: TelegramConfig, chatId: number, text: string) =>
    call<unknown>(config, "sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true } }),

  getFile: (config: TelegramConfig, fileId: string) =>
    call<TelegramFile>(config, "getFile", { file_id: fileId }),

  /** Server-side only: the returned URL contains the bot token. */
  fileUrl: (config: TelegramConfig, filePath: string) =>
    `${config.apiBase}/file/bot${config.botToken}/${filePath.split("/").map(encodeURIComponent).join("/")}`,
};
