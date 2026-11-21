# Project handoff: Telegram-backed media streaming app

Context for continuing work in a new session. Read this first, then `docs/PROJECT_GUIDE.md` (the full project guide: features, architecture, setup, captions, scripts, deployment). Nothing has been committed yet: the repo still has only the initial Create Next App commit, and all the work below is uncommitted.

## What it is

A private Netflix-style web app for about 5–10 viewers:

- **Videos live only in Telegram.** They are posted to a private channel, and a bot reads the posts.
- **The catalog is stored in Firebase Firestore** (free tier).
- **TMDB adds the poster, synopsis and rating** for each title.
- **Videos stream from Telegram to the browser through the app** (MTProto) without being stored anywhere. The bot token is never exposed.
- **The goal is 24/7 availability at almost no cost,** working even when the owner's Mac is off. It runs on an Oracle Always Free server at `https://tplayer.ccodes.in` (guide §8).

## Owner's decisions (don't undo without asking)

- **No catalog data means a "no data" screen.** Never fall back to TMDB or sample content.
- **Missing Firebase keys show a "Firebase not configured" screen.**
- **Videos must stay in Telegram.** A self-hosted Bot API server that stores files on disk was rejected; streaming is over MTProto.
- **Full quality only.** Never transcode or downscale for streaming.
- **Hidden "for now":**
  - The top-bar All/Movies/Series tabs. These live in the left sidebar instead.
  - Sidebar items: Your Videos, Favorites, Categories, Customer Reviews, Support, Logout. The pages still exist under `src/app/`.
  - The profile button and notification bell.
  - The favorite hearts. Re-enable them with `siteConfig.features.favorites` in `src/config/site.ts`.
- **TMDB credit:** shown in the sidebar footer when TMDB is configured. TMDB's terms require it.
- **Access:** viewers sign up with an email and password, and the owner approves each one at `/admin`. Basic auth was dropped in favour of this.
- **Hosting:** Oracle Always Free (arm64) at `tplayer.ccodes.in`. Each future project on `ccodes.in` gets its own subdomain, not a sub-path.
- **Secrets:** never print or log `.env.local` values. Only check whether a key is set.

## Tech stack

- **Next.js 16.4.6, App Router.** This is not the Next.js from older training data, so read `node_modules/next/dist/docs/` before using APIs (see AGENTS.md).
  - `cacheComponents` and `partialPrefetching` are on.
  - `output: "standalone"`.
  - `serverExternalPackages: ["telegram", "big-integer"]`.
- **React 19.3, Tailwind v4** (via the `@tailwindcss/turbopack` loader) **and lucide-react.** Theme tokens are defined in `src/app/globals.css` `@theme`: ink, surface, raised, card, accent, accent-soft, accent-deep, fg, muted, danger, star. The design is dark teal glassmorphism: `#091e22` base, `#0d272c` panels, `#00f0ff` accent.
- **Firebase:**
  - `firebase/firestore/lite` (Web SDK) reads the catalog on the server. It's cached with `use cache` + `cacheTag("catalog")`, about one collection read per hour.
  - `firebase-admin` does the writes (sync/webhook only).
  - Security rules (published in the Firebase console; the text is in the guide §5.2 F): public read on media, no client writes. The repo has no `firestore.rules`/`firebase.json`; the owner manages Firebase in the web console.
- **Telegram:**
  - The Bot API handles ingestion and thumbnails.
  - GramJS (`telegram@2.26.22`, MTProto) streams the videos.
- **Path alias:** `@/*` → `./src/*`.

## How content gets in

1. **The owner posts a video file to the channel** with a caption, sent as a file/document so it isn't recompressed.
2. **Ingestion picks up the post:**
   - Locally: `npm run sync`, which pulls via getUpdates. Telegram keeps pending updates for only **24 h**.
   - On the server: the Telegram webhook, `/api/telegram/webhook`.
3. **The caption is parsed** into a Firestore doc (id = Telegram `file_unique_id`).
4. **TMDB is looked up once per title and year**, and the result is stored in a nested `tmdb` field.
   - Values written explicitly on the doc win over TMDB.
   - The lookup is redone only if the title or year changes.
5. **Fixes:**
   - Edit a caption and sync again to update the entry.
   - Delete the post and sync again to remove it. Prune checks via MTProto `getMessages`, with safety valves: it skips if every post in a channel looks missing or if more than half the library looks missing.

### Caption format (`src/services/telegram/caption.parser.ts`)

```
Title (Year) | Movie|Series | Category[, Category] | Duration | SxxEyy | Episode title
```

- **Movie:** `Vacation (2015) | Movie | Comedy, Adventure | 1h 39m`
- **Series episode:** `Brickleberry (2012) | Series | Animation, Comedy | 22m | S01E01`
  - Optionally add an episode title as a last field: `… | S01E01 | Welcome Back`.
  - Keep **the same title and year on every episode**, because that's how episodes group (`seriesKey` = slug of the title).
- **Categories** split on `,`, `/` or `&`. The first one is the primary category; the rest are merged into genres.

### Subtitles

- **Upload:** a `.srt`/`.vtt` file posted as a **reply** to the video's channel post, with the language as its caption (`English`, `en`…). The file name's language code (`Movie.eng.vtt`) is the fallback.
- **Ingest:** `telegram.ingest.ts` → `attachSubtitle()` adds it to the video doc's `subtitles` array, keyed by the reply's message id. Prune also removes subtitles whose reply was deleted. `removeReplacedMedia` carries them over when the video file is replaced.
- **Serve:** `/api/subtitles/<fileId>` (`serveSubtitle()` in `telegram.stream.ts`) downloads via the Bot API, decodes UTF-8 or Windows-1252, and converts SRT → WebVTT (`subtitle.parser.ts`). It's always same-origin, because `<track>` needs that.
- **Player:** `<track kind="subtitles">` per entry. Off by default.

### Series upload: `npm run upload-series` (`scripts/upload-series.mjs`)

- **Laptop only,** for now. It refuses to run inside Docker.
- **Account:** it logs in as the **owner's own Telegram account** (GramJS user session in `~/.config/telegram-player/session`, outside the repo), because bots can't upload more than 50 MB through the Bot API.
- **One season folder per run:**
  1. `prepare-videos.sh`
  2. captions from the file name, the ffprobe duration and TMDB episode titles, validated by importing `caption.parser.ts` directly (Node 24 type stripping)
  3. per episode: post the video as a document with a thumbnail, then reply with the subtitle(s), then the next episode
  4. `POST /api/telegram/sync` plus a check of `/api/media/tv/<seriesKey>`, using the `TELEGRAM_SYNC_SECRET` service token
- **Subtitles:** separate subtitle files come in with `--subs <folder>`, matched by `SxxEyy`.
- **No duplicates:** episodes already in the app are skipped. Resume state is in `<ready>/.telegram-upload.json`.
- **Webhook race:** updates can arrive in parallel, so a subtitle reply may beat its video. `ingestSubtitle` then ingests the video from `reply_to_message` first.
- **To do:** a similar `upload-movie` script (one file, `Title (Year) | Movie | …` caption). The owner asked for this to be noted.

### Preparing files: `npm run prepare-videos -- <folder>`

`scripts/prepare-videos.sh` writes browser-ready MP4s to `<folder>/ready/`. It needs `brew install ffmpeg`, which wasn't installed on the Mac last time it was checked.

- **Video:**
  - HEVC is copied with the `hvc1` tag (needed for Safari/iOS).
  - H.264 is copied.
  - Anything else is re-encoded with libx264 at CRF 20.
- **Audio:** AAC is copied; anything else (AC-3, DTS…) becomes AAC 192k.
- **Faststart** moves the index to the front of the file.
- **Re-runs** skip files that are already finished.

## Sign-in and approval (`src/services/auth/`, `src/proxy.ts`)

- **Accounts:** Firebase Auth email/password, called over **REST from Server Actions** (`firebase-auth.rest.ts`). No Firebase Auth SDK or token reaches the browser.
  - Needs Authentication → Email/Password enabled in the Firebase console.
  - Local tests use `FIREBASE_AUTH_EMULATOR_HOST`.
- **Approvals:** `users/{uid}` in Firestore, with `status` set to `pending`, `approved` or `rejected`. It's written only through the Admin SDK; the rules deny clients.
  - Emails in `ADMIN_EMAILS` are auto-approved and can use `/admin`.
  - New sign-ups DM `TELEGRAM_ADMIN_IDS` through the bot, best effort.
- **Session:** an HMAC-signed cookie `tp_session` (`session.token.ts`, `AUTH_SECRET`) carrying uid, email, status, admin and `checkedAt`. It lasts 30 days.
- **`proxy.ts` gate:**
  - It verifies the cookie with **no I/O**, because it runs on every video range request.
  - Page loads go through `/api/auth/refresh`, which re-reads `users/{uid}` and re-issues the cookie. That happens every 15 minutes for approved users and every 10 seconds for pending or rejected ones.
  - Without a session: API calls get 401 and pages redirect to `/login?next=…`. Unapproved users get 403 or are sent to `/pending`.
  - `Authorization: Bearer $TELEGRAM_SYNC_SECRET` passes `/api/*`; the load test uses this.
  - `/api/telegram/*` and `/api/auth/*` are public, because they have their own checks.
- **Route groups:**
  - `(app)/` holds everything with the sidebar and header.
  - `(auth)/` holds `/login` and `/pending` with a bare layout.
  - The root `not-found.tsx` wraps itself in `AppShell`.
- **Gotchas:**
  - Redirects from proxy need absolute URLs; Next rewrites same-origin ones to a relative `Location`.
  - In route handlers, `request.url` shows the server's own host (localhost), so they redirect with a **relative** `Location` (`relativeRedirect`).
  - The `next/image` optimizer fetches local images without the viewer's cookie, so `/api/stream` thumbnails load **unoptimized**.
- **Not done:** a Logout link in the sidebar, which is hidden per the owner's decision. "Sign out" is on `/pending` and `/admin`. There's also no admin link in the sidebar; bookmark `/admin`.

## Streaming design (`src/services/telegram/`)

- **Route:** `src/app/api/stream/[fileId]/route.ts` calls `getStreamAsset()` in `telegram.stream.ts`.
  - If MTProto is configured (`TELEGRAM_API_ID`/`HASH`) and the doc has a channel message ref, it uses `mtproto.stream.ts`.
  - Otherwise it uses a Bot API proxy, which has a 20 MB cap and returns 413 with a hint above that.
- **`mtproto.stream.ts`:**
  - Requests 512 KB aligned `upload.GetFile` chunks.
  - Reads ahead 8 MB (`TELEGRAM_STREAM_READAHEAD_MB`) with 2 requests in flight (`TELEGRAM_STREAM_PARALLEL`).
  - Supports byte ranges, so seeking works.
  - Handles `FILE_REFERENCE_*` errors (refetches the message) and FileMigrate.
  - Sets the `X-Stream-Source: mtproto` and `X-Stream-Bot: <n>` response headers.
- **Bot pool (`mtproto.client.ts`):**
  - The pool is the main bot plus `TELEGRAM_STREAM_BOT_TOKENS` (comma-separated helper bots, each a channel admin). There are currently **4 bots** in total.
  - Each viewer is assigned to the least-busy bot (`bot-picker.ts`).
  - On a FLOOD error, the bot is marked as cooling and its viewers move to another bot.
  - On an access error, the bot is marked unusable.
- **Login:**
  - The pool is a `globalThis` singleton.
  - Logins are staggered 500 ms apart, because simultaneous logins cause "invalid new nonce hash".
  - The GramJS logger is set to `none`.
- **Pre-connect:** `src/instrumentation.ts` starts the bot logins at server boot, which cut the first play from about 10.6 s to 1.2 s.
- **`chunked-range.ts`:** a pure, unit-testable stream builder (read-ahead window, concurrency limit, `onFinish` fired exactly once).
- **Never use GramJS `iterDownload`.** It's buggy, so the code has its own GetFile loop.
- **Import only from the `"telegram"` package root.** Sub-path imports get bundled as a second copy, which causes "Only StringSession supported".

### Measured performance

- **One bot:** about 0.85–2.5 MB/s.
- **Needed per viewer:** a 1.5 GB / 90 min movie needs about 0.27 MB/s.
- **10-viewer test on the Mac with 4 bots:**
  - Viewers were spread 3/3/2/2 across the bots, with no rate limits.
  - 2 viewers ran at 0.8× realtime because the Mac's internet is only about 1.36 MB/s.
  - 4 viewers were all smooth.
- **Cloud server estimate:** 4 bots should give at least 3.6 MB/s against the 2.7 MB/s that 10 viewers need. **Unverified until deployed.** Check with `node scripts/load-test.mjs 10`.

## Next.js 16 gotchas learned the hard way

- **Hidden pages keep running:** with cacheComponents, navigating away **hides** the page (React `<Activity>`, `display:none`) instead of unmounting it, and up to 3 routes stay alive. Media keeps playing unless it's paused in a ref/layout-effect cleanup.
  - Fixed in `MediaPlayer.tsx`: the video pauses on hide (unless it's in picture-in-picture), and the YouTube iframe is blanked.
  - Guide: `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`.
- **Route handlers:** `handleRoute` must call `unstable_rethrow(error)`, or it swallows prerender bailouts.
- **Error boundaries:** `error.tsx` receives `retry`, not `reset`.
- **`usePathname` in dynamic routes:** must be wrapped in Suspense (see `PathnameBoundary`).
- **`next/image`:** use `preload`, not `priority`. Unknown hosts need `unoptimized` (handled in `MediaImage`).
- **Cache invalidation:** `revalidateTag(tag, { expire: 0 })` after sync. The global types `RouteContext`, `PageProps` and `LayoutProps` are available.
- **Server and client components:** pass rendered `<Icon/>` elements across the boundary, not component functions.
- **Only one `next dev` per directory.** For extra testing, run the standalone build: `node .next/standalone/server.js` with `PORT`. Its process title is `next-server`, so kill it by port with `lsof`, not by name.
- **`instrumentation.ts` must skip** `NEXT_PHASE === "phase-production-build"` and non-nodejs runtimes.
- **Firestore emulator:** connect it once per Firestore instance (a WeakSet), not via a global flag, because there are multiple bundle copies.
- **Firestore Admin:** call `settings()` only if this module created the app.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local app on :3000 |
| `npm run sync` | Pull new channel posts, fill in TMDB data, prune deleted posts |
| `npm run telegram -- status` | Check each bot token and whether it's a channel admin |
| `npm run telegram -- set-webhook` / `delete-webhook` | Switch between server push and local pull |
| `npm run prepare-videos -- <folder>` | Make videos browser-ready (needs ffmpeg) |
| `node scripts/load-test.mjs 10 [url]` | Simulate N viewers on the biggest movie |
| `npx tsc --noEmit && npm run lint` | Type-check and lint |
| `deploy/push.sh ubuntu@<ip> [--env]` | Deploy from the Mac |

## Environment variables (names only; values are in `.env.local`, all set)

- **Firebase Web (`NEXT_PUBLIC_*`):** `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
- **Stream URLs:** `NEXT_PUBLIC_STREAM_BASE_URL` and `NEXT_PUBLIC_PREVIEW_STREAM_URL` (optional).
- **Firebase Admin:** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- **Telegram:**
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_ADMIN_IDS`, `TELEGRAM_SYNC_SECRET`.
  - `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (from my.telegram.org).
  - `TELEGRAM_STREAM_BOT_TOKENS` (3 helper bots).
  - `TELEGRAM_STREAM_READAHEAD_MB`, `TELEGRAM_STREAM_PARALLEL`.
- **TMDB:** `TMDB_ACCESS_TOKEN` or `TMDB_API_KEY`.
- **Sign-in:** `AUTH_SECRET` and `ADMIN_EMAILS`, plus `FIREBASE_AUTH_EMULATOR_HOST` for tests only.
- **Deploy only:** `APP_DOMAIN`, which `deploy/push.sh` sets to `tplayer.ccodes.in`.
- **Test overrides (never in production):** `FIRESTORE_EMULATOR_HOST`, `TELEGRAM_API_BASE`, `TMDB_API_BASE`.

## Code map (`src/`)

- **`app/`:**
  - The `(catalog)` route group: home, movies, series, categories, watch/[id]. Its layout shows `FirebaseNotConfigured` when keys are missing.
  - `api/media`: list and details (503 if unconfigured).
  - `api/stream/[fileId]`.
  - `api/telegram/{sync,webhook}`, guarded in `telegram-route.ts`.
- **`services/library/`:** the Firestore schema, the cached `loadLibrary()` repository, the Admin writer, TMDB enrichment, and the catalog provider (series grouped by `seriesKey`).
- **`services/media/catalog.service.ts`:** the API the pages use: `getMediaList`, `getMediaDetails`, `getFeatured`, `searchMedia`.
- **`services/telegram/`:** the caption parser, Bot API client, ingest (+ prune), stream routing, and MTProto client/stream/bot picker.
- **`services/tmdb/`:** client, mappers, genres.
- **`features/`:**
  - catalog UI (cards, grid, rows, hero carousel, empty/not-configured screens)
  - media-detail (modal + `MediaPlayer`)
  - watch (`WatchView`, `EpisodeList`)
  - search, home, movies, series, categories, favorites
- **`components/layout`:** AppShell, Sidebar, Header, Logo, TmdbCredit. **`components/ui`:** Button, Pill, Badge, Modal, MediaImage, feedback.
- **`config/`:** site, navigation (sidebar sections), categories, catalog limits, image hosts.
- **Deploy:** `Dockerfile` (node:24-alpine, multi-stage), `docker-compose.yml` (app + Caddy auto-HTTPS), `deploy/Caddyfile`.
  - `deploy/push.sh user@host [--env]` rsyncs the code, writes the server's `.env` from `.env.local` on the first run, and rebuilds. It uses the SSH key `~/.ssh/oracle_tplayer`.
  - It turns off compression and flushes immediately on `/api/stream`.

## Current library state

- **Vacation (2015):** a movie, doc id `AgADhioAApSZAVQ`. A 1.58 GB HEVC file that plays in Chrome.
- **Brickleberry (2012):** a series, `tv-brickleberry`, 3 seasons, 36 episodes.
- **COINS:** a test upload that is no longer in the library.

## Testing notes

- **Earlier test harness:** it lived in the session scratchpad (`/private/tmp/claude-501/.../scratchpad`), which may be wiped. It included:
  - an e2e suite against the Firestore emulator plus fake Telegram and TMDB servers
  - unit tests for chunked-range, bot-picker and the caption parser
  - headless Chrome driven over CDP (`--remote-debugging-port`, `--autoplay-policy=no-user-gesture-required`)
  - live MTProto and 10-viewer load scripts

  Recreate whatever is needed.
- **Firestore/Auth emulators:** optional, `npx firebase-tools@14.27.0 emulators:start --only firestore,auth --project <id> --config <a firebase.json outside the repo>` (it needs an `emulators.auth.port` entry). Then set `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`.
- **Headless Chrome may not decode HEVC.** Use an H.264 title (a Brickleberry episode) for player tests.

## Open items / possible next steps

- **Deployed (2026-11-21):** live at `https://tplayer.ccodes.in` on Oracle Always Free.
  - Server: Ampere A1 (2 OCPU, 12 GB), Ubuntu 24.04 arm64. Public IP is in `DEPLOY_HOST` (`.env.local`), in the `tplayer-vcn` VCN, and GoDaddy DNS has an A record for `tplayer`. SSH in with `ssh -i ~/.ssh/oracle_tplayer <DEPLOY_HOST>`.
  - The webhook is set, and the Let's Encrypt certificate was issued.
  - The 10-viewer load test on the server ran 6–10× realtime for every viewer, 16 MB/s in total.
  - The Dockerfile's deps stage installs `python3 make g++`, because `bufferutil` has no prebuilt binary for Alpine arm64.
- **Unexplained reload loop:** an infinite-reload loop was once seen in the dev log (a burst of recompiles) and couldn't be reproduced. Watch for it.
- **Restore hidden UI** (favorites, categories, the other sidebar pages) when the owner asks.
- **Commit the work** when the owner asks. There are no commits yet beyond the initial one.
