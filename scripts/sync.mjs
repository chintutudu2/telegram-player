// Pull new Telegram uploads into Firestore and backfill TMDB posters.
//
//   npm run sync                          # app running locally (npm run dev)
//   npm run sync -- --url https://my.app  # a deployed instance
//
// Reads TELEGRAM_SYNC_SECRET from .env.local (loaded by `node --env-file`).

const argIndex = process.argv.indexOf("--url");
const base = (
  argIndex > -1 ? process.argv[argIndex + 1] : process.env.SYNC_URL || `http://localhost:${process.env.PORT || 3000}`
)?.replace(/\/+$/, "");
const secret = process.env.TELEGRAM_SYNC_SECRET;

const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

if (!secret) fail("TELEGRAM_SYNC_SECRET is not set in .env.local.");
if (!base) fail("Missing value for --url.");

let response;
try {
  response = await fetch(`${base}/api/telegram/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
} catch {
  fail(`Could not reach ${base}. Is the app running (npm run dev)?`);
}

const body = await response.json().catch(() => null);
if (!response.ok || !body?.data) {
  fail(`Sync failed (${response.status}): ${body?.error?.message ?? "unexpected response"}`);
}

const { received, saved, skipped, enrichment, webhookActive, pruned } = body.data;

const POSTER_NOTE = {
  found: "poster ✓",
  not_found: "no TMDB match — shows a title card",
  pending: "poster pending",
};
const SKIP_HINTS = {
  "no video attached": " (text/photo post — ignored)",
  "not a message": " (channel event — ignored)",
};

if (webhookActive) {
  console.log("✔ Telegram: webhook active — uploads are added automatically as you post them.");
} else {
  console.log(`✔ Telegram: ${received} new update(s), ${saved.length} saved, ${skipped.length} skipped`);
}
for (const item of saved) console.log(`   + ${item.title} (${item.type}) — ${POSTER_NOTE[item.poster] ?? ""}`);
for (const item of skipped) console.log(`   – update ${item.updateId}: ${item.reason}${SKIP_HINTS[item.reason] ?? ""}`);

if (!enrichment?.enabled) {
  console.log("ℹ Posters: TMDB not configured — add TMDB_ACCESS_TOKEN or TMDB_API_KEY to .env.local.");
} else {
  const { enriched, notFound, failed, remaining } = enrichment;
  const atUpload = saved.filter((item) => item.poster === "found").length;
  const missedAtUpload = saved.filter((item) => item.poster === "not_found").length;
  console.log(
    `✔ Posters: ${atUpload + enriched.length} added, ${missedAtUpload + notFound.length} not found on TMDB, ${failed.length} failed`,
  );
  for (const title of enriched) console.log(`   + ${title}`);
  for (const title of notFound) console.log(`   ? ${title} — no TMDB match (check the title or add the year, e.g. "Title (2010)")`);
  for (const title of failed) console.log(`   ! ${title} — lookup failed, will retry next sync`);
  if (remaining > 0) console.log(`   … ${remaining} more title(s) will be processed on the next sync`);
}

if (pruned?.enabled) {
  if (pruned.skipped) console.log(`ℹ Deleted posts: ${pruned.skipped}`);
  else if (pruned.removed.length) {
    console.log(`✔ Removed ${pruned.removed.length} title(s) whose Telegram post was deleted`);
    for (const title of pruned.removed) console.log(`   − ${title}`);
  }
}
