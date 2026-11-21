// Simulates several people watching at once and reports whether each would
// play smoothly. Run on the server after deploying:
//
//   docker compose exec app node scripts/load-test.mjs            (10 viewers)
//   docker compose exec app node scripts/load-test.mjs 15         (15 viewers)
//
// Locally (app running): node --env-file=.env.local scripts/load-test.mjs 10 http://localhost:3000
// Note: locally your home internet is usually the bottleneck, not Telegram.

const VIEWERS = Number(process.argv[2] ?? 10);
const APP = (process.argv[3] ?? "http://localhost:3000").replace(/\/+$/, "");
const PER_VIEWER_MB = 24;
const MB = 1024 * 1024;
const now = () => performance.now();
// The app requires sign-in; server-side tools pass the sync secret instead.
const AUTH = process.env.TELEGRAM_SYNC_SECRET ? { Authorization: `Bearer ${process.env.TELEGRAM_SYNC_SECRET}` } : {};

const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

// Use the biggest movie in the library (needs a runtime to know its bitrate).
const list = await fetch(`${APP}/api/media?list=trending&scope=movie`, { headers: AUTH }).then((r) => r.json()).catch(() => null);
if (!list?.data) fail(`Could not reach ${APP}. Is the app running?`);
let movie = null;
for (const item of list.data) {
  const details = (await fetch(`${APP}/api/media/movie/${item.sourceId}`, { headers: AUTH }).then((r) => r.json())).data;
  const head = await fetch(APP + details.streamUrl, { headers: { ...AUTH, Range: "bytes=0-0" } });
  await head.arrayBuffer();
  const size = Number(head.headers.get("content-range")?.split("/")[1]);
  if (details.runtime && size && (!movie || size > movie.size)) movie = { ...details, size };
}
if (!movie) fail("No movie with a known runtime to test with.");
if (movie.size < 64 * MB) fail(`Largest movie is only ${(movie.size / MB).toFixed(0)} MB; upload a full-length film first.`);

const needed = movie.size / MB / (movie.runtime * 60);
console.log(`${movie.title}: ${(movie.size / MB).toFixed(0)} MB / ${movie.runtime} min → each viewer needs ${needed.toFixed(2)} MB/s`);
console.log(`Starting ${VIEWERS} viewers at once at different points in the film…\n`);

const started = now();
const results = await Promise.all(
  Array.from({ length: VIEWERS }, async (_, i) => {
    const start = Math.floor(((i + 0.5) / VIEWERS) * (movie.size - PER_VIEWER_MB * MB));
    const t0 = now();
    const res = await fetch(APP + movie.streamUrl, { headers: { ...AUTH, Range: `bytes=${start}-${start + PER_VIEWER_MB * MB - 1}` } });
    const reader = res.body.getReader();
    let bytes = 0;
    let firstByte = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      firstByte ??= now() - t0;
      bytes += value.length;
    }
    return { bot: res.headers.get("x-stream-bot") ?? "-", firstByte, bytes, rate: bytes / MB / ((now() - t0) / 1000) };
  }),
);
const total = results.reduce((sum, r) => sum + r.bytes, 0) / MB / ((now() - started) / 1000);

results.forEach((r, i) => {
  const smooth = r.rate >= needed && r.bytes === PER_VIEWER_MB * MB;
  console.log(
    `viewer ${String(i + 1).padStart(2)}  bot ${r.bot}  starts in ${(r.firstByte / 1000).toFixed(1)}s  ` +
      `${r.rate.toFixed(2)} MB/s = ${(r.rate / needed).toFixed(1)}× realtime  ${smooth ? "✔ smooth" : "✖ would buffer"}`,
  );
});
const perBot = Object.entries(results.reduce((acc, r) => ({ ...acc, [r.bot]: (acc[r.bot] ?? 0) + 1 }), {}))
  .sort()
  .map(([bot, n]) => `bot ${bot}: ${n}`)
  .join(", ");
const allSmooth = results.every((r) => r.rate >= needed && r.bytes === PER_VIEWER_MB * MB);
console.log(`\nViewers per bot: ${perBot}`);
console.log(`Total ${total.toFixed(2)} MB/s. ${allSmooth ? "✔ All viewers would play smoothly." : "✖ Some viewers would buffer — add helper bots (TELEGRAM_STREAM_BOT_TOKENS)."}`);
