// Upload one season folder of a series to the Telegram channel, episode by
// episode, with captions and subtitle replies — then update the app's
// catalog (Firebase) and check every episode arrived.
//
// Runs on the owner's laptop only (not on the server).
//
//   npm run upload-series -- login        once: sign in to YOUR Telegram account
//
//   npm run upload-series -- ~/Downloads/"American Dad"/"Season 1" \
//     --title "American Dad! (2005)" --category "Animation, Comedy" --dry-run
//
//   …same without --dry-run to post. Add --subs <folder> when the subtitles
//   came as separate files.
//
//   npm run upload-series -- logout       sign this script out, delete its session
//
// Options:
//   --title "Name (Year)"   required; identical for every season (that's how episodes group)
//   --category "A, B"       required, e.g. "Animation, Comedy"
//   --subs <folder>         separate subtitle files (.srt/.vtt, searched in sub-folders
//                           too), matched to episodes by the SxxEyy / 1x01 in their name
//                           or folder. Leave out when there are none.
//   --sub-lang English      subtitle name when a file doesn't say its language (default English)
//   --dry-run               show every caption and subtitle; post nothing
//   --no-sync               don't update/check the catalog at the end
//   --app-url <url>         app to sync and check (default https://$DEPLOY_DOMAIN)
//
// Steps:
//   1. prepare-videos.sh: browser-ready MP4s in <folder>/ready/ and subtitles
//      inside the files extracted as .vtt. (Pass the ready/ folder to skip.)
//   2. Caption per episode:  Title (Year) | Series | Category | 22m | S01E01 | Episode title
//      Season/episode from the file name, duration from the file, episode title
//      from the file name or else TMDB. Checked with the app's caption parser.
//   3. For each episode in order: post the video as a file (never recompressed,
//      with a thumbnail), then reply with its subtitle(s), then the next episode.
//      Subtitles: one per language, the largest file; separate files (--subs) win
//      over ones extracted from the video; files under 1 KB (empty "forced"
//      tracks) are skipped. No subtitles → the episode is posted without.
//   4. Runs the catalog sync on the app and checks every posted episode (and
//      its subtitles) is in the library.
//   5. Deletes <folder>/ready/ once everything is confirmed in the app
//      (--keep-ready keeps it). It's kept if anything is missing, so a re-run
//      can finish without converting again.
//   Progress is saved in <ready>/.telegram-upload.json: re-running skips what's
//   already posted, so it's safe to run again after a dropped connection.
//
// Why your account and not the bot: bots can only upload 50 MB through the Bot
// API. The session file (~/.config/telegram-player/session) is as good as being
// logged in to your Telegram: keep it private; `logout` revokes it.
//
// TODO: a similar upload-movie script (one file, "Title (Year) | Movie | …" caption).

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Api, Logger, sessions, TelegramClient } from "telegram";
import { formatDurationSeconds, parseCaption, slugify } from "../src/services/telegram/caption.parser.ts";
import { lookupLanguage, parseSubtitleLanguage, SUBTITLE_FILE_RE } from "../src/services/telegram/subtitle.parser.ts";

const SESSION_FILE =
  process.env.TELEGRAM_USER_SESSION_FILE || join(homedir(), ".config", "telegram-player", "session");
const STATE_NAME = ".telegram-upload.json";
const MIN_SUBTITLE_BYTES = 1024;
const SCRIPTS_DIR = dirname(new URL(import.meta.url).pathname);

const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};
const expandHome = (path) => resolve(path.replace(/^~(?=$|\/)/, homedir()));

if (existsSync("/.dockerenv")) fail("This script runs on your laptop, not on the server.");

// --- Arguments ----------------------------------------------------------------

function parseArgs(argv) {
  const options = { dryRun: false, sync: true, subLang: "English" };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i] ?? fail(`Missing value for ${arg}.`);
    if (arg === "--title") options.title = value().trim();
    else if (arg === "--category") options.category = value().trim();
    else if (arg === "--subs") options.subs = expandHome(value());
    else if (arg === "--sub-lang") options.subLang = value().trim();
    else if (arg === "--app-url") options.appUrl = value().trim().replace(/\/+$/, "");
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-sync") options.sync = false;
    else if (arg === "--keep-ready") options.keepReady = true;
    else if (arg.startsWith("--")) fail(`Unknown option ${arg}.`);
    else positional.push(arg);
  }
  options.appUrl ??= `https://${process.env.DEPLOY_DOMAIN?.trim() || "tplayer.ccodes.in"}`;
  return { command: positional[0], options };
}

// --- Telegram client ------------------------------------------------------------

function makeClient(sessionString) {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH?.trim();
  if (!Number.isSafeInteger(apiId) || apiId <= 0 || !apiHash) {
    fail("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env.local (from my.telegram.org).");
  }
  const client = new TelegramClient(new sessions.StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 10,
    floodSleepThreshold: 600, // wait out Telegram's rate limits instead of failing
    baseLogger: new Logger("none"),
  });
  client.setParseMode(undefined); // captions are plain text (titles may contain * or _)
  return client;
}

const savedSession = () => (existsSync(SESSION_FILE) ? readFileSync(SESSION_FILE, "utf8").trim() : "");

function ask(question, { hidden = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(text);
    };
  }
  return new Promise((done) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      done(answer.trim());
    }),
  );
}

async function login() {
  const client = makeClient("");
  await client.start({
    phoneNumber: () => ask("Phone number (with country code, e.g. +91…): "),
    phoneCode: () => ask("Code Telegram just sent you (in the Telegram app): "),
    password: () => ask("Two-step verification password: ", { hidden: true }),
    onError: (error) => console.error(`✖ ${error.message}`),
  });
  mkdirSync(dirname(SESSION_FILE), { recursive: true, mode: 0o700 });
  writeFileSync(SESSION_FILE, client.session.save(), { mode: 0o600 });
  chmodSync(SESSION_FILE, 0o600);
  const me = await client.getMe();
  console.log(`✔ Signed in as ${me.firstName ?? ""}${me.username ? ` (@${me.username})` : ""}. Session saved to ${SESSION_FILE}`);
  await client.disconnect();
}

async function logout() {
  const session = savedSession();
  if (!session) return console.log("ℹ Not signed in.");
  const client = makeClient(session);
  try {
    await client.connect();
    await client.invoke(new Api.auth.LogOut());
  } catch {
    // Already revoked (e.g. from Telegram's Devices list); just delete the file.
  }
  rmSync(SESSION_FILE, { force: true });
  console.log("✔ Signed out and deleted the session file.");
  await client.disconnect().catch(() => {});
}

async function connect() {
  const session = savedSession();
  if (!session) fail("Not signed in. Run: npm run upload-series -- login");
  const client = makeClient(session);
  await client.connect();
  if (!(await client.checkAuthorization())) {
    fail("The saved session expired or was revoked. Run: npm run upload-series -- login");
  }
  return client;
}

async function resolveChannel(client) {
  const id = Number((process.env.TELEGRAM_CHANNEL_ID ?? "").split(",")[0]?.trim());
  if (!Number.isSafeInteger(id) || id === 0) fail("Set TELEGRAM_CHANNEL_ID in .env.local.");
  try {
    return await client.getEntity(id);
  } catch {
    await client.getDialogs({ limit: 500 }); // a fresh session knows no chats yet
    try {
      return await client.getEntity(id);
    } catch {
      fail(`Your account can't see channel ${id}. Make sure you're an admin of it.`);
    }
  }
}

// --- File names -------------------------------------------------------------------

const EPISODE_PATTERNS = [/S(\d{1,2})[\s._-]*E(\d{1,3})/i, /(?:^|[^\d])(\d{1,2})x(\d{2,3})(?!\d)/i];
// Release-name junk that ends an episode title ("Pilot 1080p WEB-DL x264").
const JUNK_RE =
  /[[(]|\b(480p|576p|720p|1080p|2160p|4k|uhd|web|webrip|web-dl|webdl|hdtv|hdrip|bluray|blu-ray|brrip|bdrip|dvdrip|x264|x265|h264|h265|hevc|avc|aac|ac3|eac3|ddp|dd5|10bit|proper|repack|amzn|nf|hulu|dsnp|internal)\b/i;

function episodeOf(text) {
  for (const pattern of EPISODE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return { season: Number(match[1]), episode: Number(match[2]), end: match.index + match[0].length };
  }
  return null;
}

const episodeKey = ({ season, episode }) => `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;

function episodeTitleOf(stem, end) {
  let rest = stem.slice(end);
  if (!/\s/.test(stem)) rest = rest.replace(/[._]/g, " "); // "Show.S01E01.Pilot.1080p"
  const junk = JUNK_RE.exec(rest);
  if (junk) rest = rest.slice(0, junk.index);
  rest = rest.replace(/\|/g, "-").replace(/\s+/g, " ").replace(/^[\s\-–—:.]+|[\s\-–—:.]+$/g, "");
  return rest.length >= 2 ? rest : null;
}

/**
 * Language of a separate subtitle file: the last name part ("….en.srt",
 * "….English.srt"), else a language name anywhere ("2_English.srt").
 * Two-letter codes only count as the last part ("It" is also a word).
 */
function languageOfFile(name) {
  const tokens = name.replace(SUBTITLE_FILE_RE, "").split(/[\s._\-()[\]]+/).filter(Boolean);
  const last = tokens.at(-1);
  if (last && lookupLanguage(last)) return lookupLanguage(last);
  for (const token of tokens.toReversed()) {
    if (token.length > 3 && lookupLanguage(token)) return lookupLanguage(token);
  }
  return null;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : entry.name.startsWith(".") ? [] : [path];
  });
}

/** Separate subtitle files by episode ("S01E01" → files), from --subs. */
function separateSubtitles(folder) {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) fail(`Subtitle folder not found: ${folder}`);
  const byEpisode = new Map();
  const unmatched = [];
  for (const path of walk(folder)) {
    if (!SUBTITLE_FILE_RE.test(path)) continue;
    // The episode code may be in the file name or a folder ("Subs/Show.S01E01…/2_English.srt").
    const episode = episodeOf(basename(path)) ?? episodeOf(relative(folder, path));
    if (!episode) {
      unmatched.push(relative(folder, path));
      continue;
    }
    const key = episodeKey(episode);
    byEpisode.set(key, [...(byEpisode.get(key) ?? []), path]);
  }
  return { byEpisode, unmatched };
}

// --- TMDB episode titles -------------------------------------------------------------

async function tmdb(path, params = {}) {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!token && !apiKey) return null;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [key, value] of Object.entries({ language: "en-US", ...params })) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  if (!token) url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok ? response.json() : null;
}

/** "S01E01" → episode name, for the seasons asked; empty when TMDB isn't set up or has no match. */
async function tmdbEpisodeTitles(title, seasons) {
  const titles = new Map();
  try {
    const name = title.replace(/\s*\(\d{4}\)\s*$/, "");
    const year = /\((\d{4})\)\s*$/.exec(title)?.[1];
    const search = await tmdb("/search/tv", { query: name, first_air_date_year: year });
    const show = search?.results?.[0];
    if (!show) return titles;
    for (const season of seasons) {
      const data = await tmdb(`/tv/${show.id}/season/${season}`);
      for (const episode of data?.episodes ?? []) {
        if (episode.name) titles.set(episodeKey({ season, episode: episode.episode_number }), episode.name.trim());
      }
    }
  } catch {
    // Titles are optional: captions just leave them out.
  }
  return titles;
}

// --- Planning ---------------------------------------------------------------------

function probe(file) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file],
    { encoding: "utf8" },
  );
  const data = JSON.parse(result.stdout || "{}");
  return {
    duration: Math.round(Number(data.format?.duration) || 0),
    width: data.streams?.[0]?.width ?? 0,
    height: data.streams?.[0]?.height ?? 0,
  };
}

/**
 * One subtitle per language: the largest file, with separate files (--subs)
 * preferred over ones extracted from the video. Tiny "forced" tracks skipped.
 */
function pickSubtitles(separate, extracted, fallbackLabel) {
  const best = new Map();
  const consider = (path, language, rank) => {
    const size = statSync(path).size;
    if (size < MIN_SUBTITLE_BYTES) return;
    const label = language?.label ?? fallbackLabel;
    const key = language?.lang ?? label.toLowerCase();
    const current = best.get(key);
    if (!current || rank > current.rank || (rank === current.rank && size > current.size)) {
      best.set(key, { path, name: basename(path), label, size, rank });
    }
  };
  for (const path of separate) consider(path, languageOfFile(basename(path)), 2);
  for (const path of extracted) {
    const detected = parseSubtitleLanguage(undefined, basename(path));
    consider(path, detected.lang ? detected : null, 1);
  }
  return [...best.values()];
}

async function buildPlan(readyDir, options) {
  const files = readdirSync(readyDir).filter((name) => !name.startsWith("."));
  const videos = files.filter((name) => /\.mp4$/i.test(name));
  if (videos.length === 0) fail(`No .mp4 files in ${readyDir}.`);
  const separate = options.subs ? separateSubtitles(options.subs) : { byEpisode: new Map(), unmatched: [] };

  const problems = separate.unmatched.map((name) => `subtitle file ${name}: no SxxEyy / 1x01 in its name — not used`);
  const found = [];
  for (const name of videos) {
    const stem = name.replace(/\.mp4$/i, "");
    const episode = episodeOf(stem);
    if (!episode) {
      problems.push(`${name}: no SxxEyy / 1x01 in the file name — skipped`);
      continue;
    }
    found.push({ name, stem, episode, key: episodeKey(episode), fileTitle: episodeTitleOf(stem, episode.end) });
  }

  // Episode titles: from the file name, else TMDB.
  const needTitles = found.filter((item) => !item.fileTitle);
  const tmdbTitles = needTitles.length
    ? await tmdbEpisodeTitles(options.title, [...new Set(needTitles.map((item) => item.episode.season))])
    : new Map();

  const plan = [];
  for (const { name, stem, episode, key, fileTitle } of found) {
    const { duration, width, height } = probe(join(readyDir, name));
    const episodeTitle = (fileTitle ?? tmdbTitles.get(key) ?? null)?.replace(/\|/g, "-") ?? null;
    const fields = [options.title, "Series", options.category];
    if (duration >= 60) fields.push(formatDurationSeconds(duration));
    fields.push(key);
    if (episodeTitle) fields.push(episodeTitle);
    const caption = fields.join(" | ");

    // Check it reads back exactly as intended, using the app's own parser.
    const parsed = parseCaption(caption);
    const ok =
      parsed.ok &&
      parsed.value.season === episode.season &&
      parsed.value.episode === episode.episode &&
      parsed.value.episodeTitle === episodeTitle;
    if (!ok) {
      problems.push(`${name}: caption "${caption}" doesn't read back correctly — skipped`);
      continue;
    }

    const extracted = files
      .filter((file) => file.startsWith(`${stem}.`) && SUBTITLE_FILE_RE.test(file))
      .map((file) => join(readyDir, file));
    plan.push({
      name,
      key,
      path: join(readyDir, name),
      caption,
      titleSource: fileTitle ? "file name" : episodeTitle ? "TMDB" : null,
      duration,
      width,
      height,
      order: episode.season * 10_000 + episode.episode,
      subtitles: pickSubtitles(separate.byEpisode.get(key) ?? [], extracted, options.subLang),
    });
  }
  plan.sort((a, b) => a.order - b.order);

  const duplicates = plan.filter((item, index) => plan.findIndex((other) => other.key === item.key) !== index);
  if (duplicates.length) fail(`Two files are the same episode: ${duplicates.map((item) => item.key).join(", ")}. Remove one.`);
  return { plan, problems };
}

// --- Upload -----------------------------------------------------------------------

const loadState = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
const saveState = (file, state) => writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);

function makeThumbnail(item) {
  const out = join(tmpdir(), `tplayer-thumb-${process.pid}.jpg`);
  const at = Math.min(Math.max(item.duration * 0.1, 1), 300);
  const result = spawnSync("ffmpeg", [
    "-nostdin", "-loglevel", "error", "-y", "-ss", String(at), "-i", item.path, "-frames:v", "1",
    "-vf", "scale=320:320:force_original_aspect_ratio=decrease", "-q:v", "6", out,
  ]);
  return result.status === 0 && existsSync(out) ? out : null;
}

function progress(label) {
  let last = -1;
  return (fraction) => {
    const percent = Math.floor(fraction * 100);
    if (percent === last) return;
    last = percent;
    if (process.stdout.isTTY) process.stdout.write(`\r   ${label} ${percent}%   `);
    else if (percent % 25 === 0) console.log(`   ${label} ${percent}%`);
  };
}

async function uploadEpisode(client, channel, item, entry) {
  if (!entry.messageId) {
    const thumb = item.width && item.height ? makeThumbnail(item) : null;
    const message = await client.sendFile(channel, {
      file: item.path,
      caption: item.caption,
      forceDocument: true, // sent "as file": never recompressed
      workers: 8,
      ...(thumb && { thumb }),
      attributes: [
        new Api.DocumentAttributeFilename({ fileName: item.name }),
        ...(thumb
          ? [new Api.DocumentAttributeVideo({ duration: item.duration, w: item.width, h: item.height, supportsStreaming: true })]
          : []),
      ],
      progressCallback: progress("uploading"),
    });
    if (thumb) rmSync(thumb, { force: true });
    if (process.stdout.isTTY) process.stdout.write("\r");
    entry.messageId = message.id;
    console.log(`   ✔ video posted                `);
  }
  entry.subtitles ??= {};
  for (const subtitle of item.subtitles) {
    if (entry.subtitles[subtitle.name]) continue;
    const reply = await client.sendFile(channel, {
      file: subtitle.path,
      caption: subtitle.label,
      forceDocument: true,
      replyTo: entry.messageId,
      attributes: [new Api.DocumentAttributeFilename({ fileName: subtitle.name })],
    });
    entry.subtitles[subtitle.name] = reply.id;
    console.log(`   ✔ ${subtitle.label} subtitles replied`);
  }
  if (item.subtitles.length === 0) console.log("   – no subtitles for this episode");
}

// --- Catalog sync + check ------------------------------------------------------------

async function appRequest(appUrl, path, init = {}) {
  const secret = process.env.TELEGRAM_SYNC_SECRET?.trim();
  if (!secret) throw new Error("TELEGRAM_SYNC_SECRET is not set in .env.local.");
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(body?.error?.message ?? `HTTP ${response.status}`), { status: response.status });
  }
  return body?.data;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const seriesKeyOf = (title) => slugify(title.replace(/\s*\(\d{4}\)\s*$/, ""));

/** Episodes of this series already in the app ("S01E01" → episode), or null if the app can't be reached. */
async function episodesInApp(options) {
  try {
    const details = await appRequest(options.appUrl, `/api/media/tv/${seriesKeyOf(options.title)}`);
    return new Map((details?.episodeList ?? []).map((e) => [episodeKey(e), e]));
  } catch (error) {
    if (error.status === 404) return new Map(); // series not uploaded yet
    console.warn(`⚠ Couldn't check ${options.appUrl} for episodes already uploaded (${error.message}).`);
    return null;
  }
}

/** Runs the catalog sync, then checks each posted episode (and subtitle count) is in the library. Returns true if all are. */
async function syncAndCheck(options, plan, state) {
  console.log(`\n→ Updating the catalog on ${options.appUrl}`);
  try {
    const report = await appRequest(options.appUrl, "/api/telegram/sync", { method: "POST" });
    if (report.webhookActive) console.log("   ✔ webhook active: uploads were added as they were posted");
    else console.log(`   ✔ added ${report.saved.length} video(s) and ${report.subtitles?.length ?? 0} subtitle(s)`);
    for (const item of report.skipped ?? []) console.log(`   ⚠ update ${item.updateId}: ${item.reason}`);
    if (report.enrichment?.enriched?.length) console.log(`   ✔ posters added: ${report.enrichment.enriched.join(", ")}`);
  } catch (error) {
    console.log(`   ⚠ sync failed: ${error.message}`);
  }

  const expected = plan.filter((item) => state[item.name]?.messageId);
  let missing = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt) await sleep(5_000); // webhook deliveries may still be landing
    try {
      const details = await appRequest(options.appUrl, `/api/media/tv/${seriesKeyOf(options.title)}`);
      const episodes = new Map((details?.episodeList ?? []).map((e) => [episodeKey(e), e]));
      missing = expected.flatMap((item) => {
        const episode = episodes.get(item.key);
        if (!episode) return [`${item.key}: not in the app`];
        if ((episode.subtitles?.length ?? 0) < item.subtitles.length) return [`${item.key}: subtitles missing`];
        return [];
      });
    } catch (error) {
      missing = [`couldn't read the series from the app (${error.message})`];
    }
    if (missing.length === 0) break;
  }

  if (missing.length === 0) {
    console.log(`   ✔ all ${expected.length} episode(s) are in the app, with their subtitles`);
    return true;
  }
  console.log("   ⚠ not everything is in the app yet:");
  for (const line of missing) console.log(`     – ${line}`);
  console.log("   Wait a minute and re-run the same command: posted episodes are skipped, only the check runs again.");
  return false;
}

// --- Main -------------------------------------------------------------------------

const { command, options } = parseArgs(process.argv.slice(2));
const USAGE =
  'Usage: npm run upload-series -- <season folder> --title "Name (Year)" --category "A, B" [--subs <folder>] [--dry-run]   (or: login, logout)';
if (!command) fail(USAGE);
if (command === "login") {
  await login();
  process.exit(0);
}
if (command === "logout") {
  await logout();
  process.exit(0);
}

const folder = expandHome(command);
if (!existsSync(folder) || !statSync(folder).isDirectory()) fail(`Folder not found: ${folder}`);
if (!options.title) fail('Missing --title, e.g. --title "American Dad! (2005)".');
if (!options.category) fail('Missing --category, e.g. --category "Animation, Comedy".');
if (!/\(\d{4}\)\s*$/.test(options.title)) console.warn('⚠ Add the year to --title, e.g. "American Dad! (2005)" — TMDB matches are much better with it.');

let readyDir = folder;
if (basename(folder) !== "ready") {
  const prepared = spawnSync("bash", [join(SCRIPTS_DIR, "prepare-videos.sh"), folder], {
    stdio: "inherit",
    env: { ...process.env, FROM_UPLOAD_SCRIPT: "1" },
  });
  if (prepared.status !== 0) fail("prepare-videos.sh failed (see above).");
  readyDir = join(folder, "ready");
}

const stateFile = join(readyDir, STATE_NAME);
const state = loadState(stateFile);
const { plan, problems } = await buildPlan(readyDir, options);
for (const problem of problems) console.warn(`⚠ ${problem}`);

// Episodes already in the app (posted by hand, or by an earlier run whose
// progress file is gone) are skipped so they don't appear twice.
const inApp = await episodesInApp(options);
const alreadyInApp = plan.filter((item) => !state[item.name]?.messageId && inApp?.has(item.key));
for (const item of alreadyInApp) {
  const subs = inApp.get(item.key).subtitles?.length ?? 0;
  console.log(`ℹ ${item.key} is already in the app${subs ? " (with subtitles)" : " (no subtitles)"} — skipped`);
}

const pending = plan.filter((item) => {
  if (alreadyInApp.includes(item)) return false;
  const entry = state[item.name];
  return !entry?.messageId || item.subtitles.some((s) => !entry.subtitles?.[s.name]);
});

console.log(`\n${plan.length} episode(s) found, ${plan.length - pending.length} already posted, ${pending.length} to post:\n`);
for (const item of pending) {
  console.log(`• ${item.name}`);
  console.log(`   caption:  ${item.caption}${item.titleSource === "TMDB" ? "   (episode title from TMDB — check it)" : ""}`);
  if (item.subtitles.length === 0) console.log("   subtitle: none");
  for (const s of item.subtitles) console.log(`   subtitle: ${s.name}  →  reply captioned "${s.label}"`);
}
if (options.dryRun) {
  console.log("\nDry run: nothing was posted.");
  process.exit(0);
}

if (pending.length) {
  const client = await connect();
  const channel = await resolveChannel(client);
  try {
    for (const [index, item] of pending.entries()) {
      console.log(`\n→ [${index + 1}/${pending.length}] ${item.caption}`);
      const entry = (state[item.name] ??= {});
      try {
        await uploadEpisode(client, channel, item, entry);
      } finally {
        saveState(stateFile, state); // keep progress even if this episode failed halfway
      }
    }
  } catch (error) {
    fail(`Upload stopped: ${error.message}\n  Run the same command again to continue where it stopped.`);
  }
  await client.disconnect();
  console.log(`\n✔ Posted ${pending.length} episode(s).`);
}

const complete = options.sync && (await syncAndCheck(options, plan, state));

// The converted copies are only needed until everything is safely in the app.
if (complete && !options.keepReady && readyDir !== folder) {
  rmSync(readyDir, { recursive: true, force: true });
  console.log(`   ✔ deleted ${readyDir}`);
} else if (!complete && readyDir !== folder && options.sync) {
  console.log(`   ℹ kept ${readyDir} (not everything is confirmed in the app yet)`);
}
process.exit(0);
