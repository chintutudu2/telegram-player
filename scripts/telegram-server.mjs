// Telegram bot helpers.
//
//   npm run telegram -- status          Webhook state, and whether every streaming
//                                       bot (main + helpers) is a channel admin.
//   node scripts/telegram-server.mjs set-webhook     On the server (inside the
//        app container): deliver new channel posts to the app instantly.
//   node scripts/telegram-server.mjs delete-webhook  Go back to `npm run sync`.
//
// Reads TELEGRAM_BOT_TOKEN, TELEGRAM_SYNC_SECRET and APP_DOMAIN (or
// TELEGRAM_WEBHOOK_URL) from the environment. The token is never printed.

const API = "https://api.telegram.org";
const token = process.env.TELEGRAM_BOT_TOKEN;

const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

async function call(method, params = {}, botToken = token, { soft = false } = {}) {
  let response;
  try {
    response = await fetch(`${API}/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    if (soft) return { error: "could not reach Telegram" };
    fail(`Could not reach Telegram (${method}).`);
  }
  const body = await response.json().catch(() => null);
  if (!body?.ok) {
    if (soft) return { error: body?.description ?? `HTTP ${response.status}` };
    fail(`${method} failed: ${body?.description ?? `HTTP ${response.status}`}`);
  }
  return body.result;
}

const helperTokens = (process.env.TELEGRAM_STREAM_BOT_TOKENS ?? "")
  .split(",")
  .map((t) => t.trim())
  .filter((t) => t && t !== token);

if (!token) fail("TELEGRAM_BOT_TOKEN is not set.");

switch (process.argv[2]) {
  case "set-webhook": {
    const secret = process.env.TELEGRAM_SYNC_SECRET;
    const domain = process.env.APP_DOMAIN?.trim();
    const url = process.env.TELEGRAM_WEBHOOK_URL || (domain && `https://${domain}/api/telegram/webhook`);
    if (!secret) fail("TELEGRAM_SYNC_SECRET is not set.");
    if (!url) fail("Set APP_DOMAIN (or TELEGRAM_WEBHOOK_URL).");
    await call("setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"],
    });
    console.log(`✔ Webhook set: new channel posts are delivered to ${url}`);
    break;
  }
  case "delete-webhook": {
    await call("deleteWebhook");
    console.log("✔ Webhook removed. Use `npm run sync` to pull new posts.");
    break;
  }
  case "status": {
    const channel = process.env.TELEGRAM_CHANNEL_ID?.trim();
    const hook = await call("getWebhookInfo");
    console.log(`Webhook:  ${hook.url || "(none — run `npm run sync` to pull new posts)"}`);
    if (hook.pending_update_count) console.log(`Pending:  ${hook.pending_update_count} update(s)`);
    if (hook.last_error_message) console.log(`Last error: ${hook.last_error_message}`);

    console.log(`\nStreaming bots (${1 + helperTokens.length}):`);
    let problems = 0;
    for (const [index, botToken] of [token, ...helperTokens].entries()) {
      const me = await call("getMe", {}, botToken, { soft: true });
      if (me.error) {
        problems++;
        console.log(`  ${index + 1}. ✖ invalid token (${me.error})`);
        continue;
      }
      let access = "channel not checked (TELEGRAM_CHANNEL_ID is empty)";
      if (channel) {
        const member = await call("getChatMember", { chat_id: channel, user_id: me.id }, botToken, { soft: true });
        const ok = ["administrator", "creator"].includes(member.status);
        if (!ok) problems++;
        access = ok ? "✔ channel admin" : `✖ not a channel admin (${member.error ?? member.status}) — add it as an admin`;
      }
      console.log(`  ${index + 1}. @${me.username}${index === 0 ? " (main)" : ""} — ${access}`);
    }
    if (problems === 0 && helperTokens.length === 0) {
      console.log("\nTip: add helper bots to TELEGRAM_STREAM_BOT_TOKENS so more people can watch at once.");
    }
    break;
  }
  default:
    fail("Usage: telegram-server.mjs <status | set-webhook | delete-webhook>");
}
