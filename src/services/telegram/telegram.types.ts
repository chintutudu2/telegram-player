/** Subset of Telegram Bot API types used by ingestion and streaming. */

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramFileBase {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

export interface TelegramVideo extends TelegramFileBase {
  width: number;
  height: number;
  /** Seconds. */
  duration: number;
}

export type TelegramDocument = TelegramFileBase;

export interface TelegramMessage {
  message_id: number;
  /** Unix seconds. */
  date: number;
  chat: { id: number; type: "private" | "group" | "supergroup" | "channel"; title?: string };
  from?: { id: number; is_bot: boolean; username?: string };
  caption?: string;
  video?: TelegramVideo;
  document?: TelegramDocument;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  /** Relative on the public Bot API; absolute path on a `--local` server. */
  file_path?: string;
}

export type TelegramResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error_code: number; description: string };
