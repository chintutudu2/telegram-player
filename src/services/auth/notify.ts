import "server-only";

import { telegramApi } from "@/services/telegram/telegram.client";
import { getTelegramConfig } from "@/services/telegram/telegram.config";

/**
 * Best-effort Telegram DM to TELEGRAM_ADMIN_IDS when someone asks for access.
 * The admin must have pressed Start in a chat with the bot once.
 */
export async function notifyAdminsOfSignUp(email: string): Promise<void> {
  const config = getTelegramConfig();
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!config || adminIds.length === 0) return;

  const domain = process.env.APP_DOMAIN?.trim();
  const text = `New access request: ${email}\n${domain ? `Approve at https://${domain}/admin` : "Approve it on the /admin page."}`;
  await Promise.allSettled(adminIds.map((id) => telegramApi.sendMessage(config, id, text)));
}
