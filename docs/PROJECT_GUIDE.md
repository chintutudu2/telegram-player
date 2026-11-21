# Telegram Player: Project Guide

The complete reference for this project: what it does, how it is built, how to set it up from scratch, how to add movies and series, how to run every script, and how to deploy and operate it.

- **Production:** <https://tplayer.ccodes.in>
- **Session notes for AI assistants:** [`HANDOFF.md`](../HANDOFF.md)
- **Next.js version notes:** [`AGENTS.md`](../AGENTS.md)

---

## Contents

1. [What the app is](#1-what-the-app-is)
2. [Features and requirements](#2-features-and-requirements)
3. [Tech stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Setting up the project from scratch](#5-setting-up-the-project-from-scratch)
6. [Uploading movies and series](#6-uploading-movies-and-series)
7. [Scripts and commands](#7-scripts-and-commands)
8. [Deploying to a server](#8-deploying-to-a-server)
9. [Day-to-day operations](#9-day-to-day-operations)
10. [Troubleshooting](#10-troubleshooting)
11. [Development notes and gotchas](#11-development-notes-and-gotchas)
12. [Environment variable reference](#12-environment-variable-reference)

---

## 1. What the app is

The app is a private, Netflix-style streaming site for a small group of about 5–10 viewers:

- **Videos live only in Telegram.** The owner posts video files to a private Telegram channel, and nothing is stored on the server or in the cloud.
- **The catalog lives in Firebase Firestore.** It records titles, types, episodes, categories and the Telegram file references, and fits in the free tier.
- **TMDB fills in posters, synopses and ratings** automatically.
- **Streaming goes through the app's server.** When someone presses Play, the server fetches only the part being watched from Telegram (over MTProto) and passes it to the browser. The bot tokens never leave the server.
- **Access needs an account and approval.** Viewers sign up with email and password, and the owner approves each one.
- **The app runs 24/7 at almost no cost** on a free Oracle Cloud server, behind HTTPS at its own domain.

---

## 2. Features and requirements

### 2.1 Viewer features

| Feature | Details |
| --- | --- |
| Browse | Home page (all titles), Movies and Series pages, each with a hero carousel, rows, and a genre filter |
| Categories | Full genre browser (`/categories`). The page exists but the link is hidden for now. |
| Search | Header search across titles and genres, scoped to the current section |
| Title details | Popup with poster, backdrop, synopsis, rating, year, duration and genres |
| Watch page | `/watch/movie-<id>` and `/watch/tv-<series>?episode=<id>`, with a dedicated player and an episode list grouped by season |
| Player | Native HTML5 video with seeking and picture-in-picture. Pauses automatically when you navigate away. |
| Full-quality playback | Files play exactly as uploaded; nothing is transcoded or downscaled |
| Sign-in | `/login`: sign in, request access (sign up), or reset a forgotten password by email |
| Approval screen | `/pending`: shown until the owner approves the account, with "Check again" and "Sign out" |

### 2.2 Owner (admin) features

| Feature | Details |
| --- | --- |
| Upload by posting to Telegram | Post a video file with a caption to the channel; it appears in the app within seconds |
| Edit and delete | Edit a caption to change the entry. Delete a post and run sync to remove it. |
| Automatic metadata | TMDB poster, backdrop, synopsis, rating and genres are looked up once per title and year |
| Approve viewers | `/admin`: approve, decline or revoke accounts |
| Sign-up alerts | The bot DMs the owner on Telegram when someone requests access |
| Capacity | Several "helper" bots share the streaming load (about 3 simultaneous viewers per bot) |
| One-command deploy | `deploy/push.sh` from the Mac |

### 2.3 Requirements and owner decisions

These are deliberate decisions. Don't change them without the owner's agreement.

1. **Videos stay in Telegram.** No video storage on the server. A self-hosted Bot API server that stores files on disk was rejected.
2. **Full quality only.** Never transcode or downscale for streaming.
3. **Firestore is the only catalog source.**
   - Without catalog data, show a "no data" screen. Never fall back to TMDB or sample content.
   - Without Firebase keys, show a "Firebase not configured" screen.
4. **Only approved accounts can watch.** Every page, API call and video request needs an approved session.
5. **Cost is close to zero:** Firestore free tier, Oracle Always Free server, free Let's Encrypt HTTPS.
6. **The app works with the owner's Mac turned off.** Everything runs on the server.
7. **TMDB credit** is shown in the sidebar footer whenever TMDB is configured, because TMDB's terms require it.
8. **Secrets are never printed or logged.** Tools only check whether a key is set.
9. **Hidden "for now"** (built, but not shown):
   - The top-bar All/Movies/Series tabs. The left sidebar has them instead.
   - Sidebar items: Your Videos, Favorites, Categories, Customer Reviews, Support, Logout. The pages still exist under `src/app/(app)/`.
   - The profile button and notification bell.
   - Favorite hearts. Turn them on with `siteConfig.features.favorites` in `src/config/site.ts`.
10. **Each project on `ccodes.in` gets its own subdomain** (e.g. `tplayer.ccodes.in`), never a sub-path.

### 2.4 Non-functional targets

| Target | Measured |
| --- | --- |
| 10 people watching at once | Load test on the server: every viewer at 6–10× realtime, 16 MB/s in total with 4 bots |
| Fast first play | About 1.2 s, because the bots log in when the server starts |
| Firestore cost independent of traffic | About one collection read per hour, from a server-side cache |
| Lose access soon after revocation | Within 15 minutes |

---

## 3. Tech stack

| Layer | Technology | Version | Notes |
| --- | --- | --- | --- |
| Framework | **Next.js** (App Router) | 16.4.6 | `cacheComponents`, `partialPrefetching`, `output: "standalone"`, `proxy.ts` (formerly middleware) |
| UI | **React** | 19.3 | Server Components, Server Actions, `useActionState` |
| Styling | **Tailwind CSS** v4 | 4.3.3 | Uses the `@tailwindcss/turbopack` loader. Theme tokens are in `src/app/globals.css` `@theme`. |
| Icons | **lucide-react** | 1.75 | |
| Language | **TypeScript** | 5 | Path alias `@/*` → `./src/*` |
| Bundler | **Turbopack** | (Next built-in) | |
| Catalog DB | **Firebase Firestore** | Web SDK 13.4 (`firestore/lite`) for reads, Admin SDK 14.5 for writes | Free tier |
| Accounts | **Firebase Authentication** (Email/Password) | REST API | Called from the server only; no Auth SDK in the browser |
| Video source | **Telegram Bot API** | | Ingests new posts and serves thumbnails |
| Video streaming | **GramJS** (`telegram` package, MTProto) | 2.26.22 | Streams full-length files with byte ranges |
| Metadata | **TMDB API** | v3/v4 | Posters, synopses, ratings, genres |
| Runtime | **Node.js** | 24 | `node:24-alpine` Docker image |
| Containers | **Docker** + Docker Compose | | Two services: `app` and `caddy` |
| HTTPS / reverse proxy | **Caddy** | 2.10 | Automatic Let's Encrypt certificates; streams video without buffering |
| Hosting | **Oracle Cloud Always Free** | Ampere A1 (arm64), 2 OCPU / 12 GB, Ubuntu 24.04 | |
| DNS | **GoDaddy** | | An A record points `tplayer` at the server |
| Video prep (optional) | **ffmpeg** | | `scripts/prepare-videos.sh` |
| Lint | **ESLint** 9 + `eslint-config-next` | | |

**Design:** dark teal glassmorphism. The base is `#091e22`, panels are `#0d272c`, and the accent is `#00f0ff`. The theme tokens are ink, surface, raised, card, accent, accent-soft, accent-deep, fg, muted, danger and star. The font is Outfit.

---

## 4. Architecture

### 4.1 System overview

```mermaid
flowchart LR
  subgraph Owner
    TG[Telegram app]
  end
  subgraph Telegram
    CH[(Private channel<br/>video files)]
    BOT[Main bot + 3 helper bots]
  end
  subgraph Server["Oracle server (Docker)"]
    CADDY[Caddy<br/>HTTPS :443]
    APP[Next.js app<br/>proxy.ts gate<br/>pages, API, stream relay]
  end
  subgraph Google
    FS[(Firestore<br/>media, users, system)]
    FA[Firebase Auth<br/>email/password]
  end
  TMDB[TMDB API]
  V[Viewer's browser]

  TG -- post video + caption --> CH
  CH -- webhook (new/edited post) --> CADDY --> APP
  APP -- write catalog entry --> FS
  APP -- poster/synopsis lookup --> TMDB
  V -- HTTPS --> CADDY
  APP -- read catalog (cached 1h) --> FS
  APP -- sign in / sign up --> FA
  APP -- MTProto byte ranges --> BOT --> CH
```

### 4.2 Main flows

**A. Uploading content (push mode, in production)**
1. The owner posts a video **as a file** with a caption to the channel.
2. Telegram calls `POST /api/telegram/webhook`. The request carries a secret header, which is checked against `TELEGRAM_SYNC_SECRET`.
3. `telegram.ingest.ts` does the following:
   - checks that the post comes from an allowed chat
   - finds the video (a `video`, or a `document` with a video MIME type or extension)
   - parses the caption (`caption.parser.ts`)
   - looks the title up on TMDB once (`library.enrichment.ts`)
   - upserts `media/{file_unique_id}` through the Admin SDK (`media.writer.ts`)
4. The `catalog` cache tag is expired, so the next page load shows the new title.

**B. Browsing**
1. Server Components call `services/media/catalog.service.ts`.
2. That service loads the whole `media` collection once per cache window (`use cache` + `cacheTag("catalog")`, 1 hour or until the next sync), using the Firestore Web SDK.
3. Lists, filters, search and series grouping (by `seriesKey`) are computed in memory, so Firestore reads don't grow with traffic.
4. Browser code uses `/api/media` and `/api/media/:type/:id`. Server credentials never reach the browser.

**C. Playing a video**
1. The player requests `/api/stream/<telegramFileId>` with HTTP `Range` headers.
2. `proxy.ts` checks the session cookie. This involves no I/O.
3. `api/stream/[fileId]/route.ts` serves only files that are in the library, so it isn't an open proxy.
4. With MTProto configured (`TELEGRAM_API_ID`/`HASH`), `mtproto.stream.ts` streams the file:
   - It fetches aligned 512 KB `upload.GetFile` chunks and reads 8 MB ahead, with 2 requests in flight.
   - `bot-picker.ts` gives each viewer the least-busy bot.
   - If Telegram rate-limits a bot (FLOOD), its viewers move to another bot.
   - Expired file references are refreshed by re-fetching the channel message.
5. Without MTProto, it falls back to the Bot API, which caps files at 20 MB (413 above that).
6. Caddy passes the bytes through with compression off and flushing on every write.

**D. Signing in and approval**
1. **Sign up or sign in:** `/login` posts to a Server Action (`auth.actions.ts`), which calls the Firebase Auth REST API (`firebase-auth.rest.ts`).
2. **Account record:** on first sign-in, `users/{uid}` is created with `status: "pending"`. Emails listed in `ADMIN_EMAILS` are approved automatically. A new request triggers a Telegram DM to each id in `TELEGRAM_ADMIN_IDS`.
3. **Session:** the server sets `tp_session`, an HMAC-signed cookie (`AUTH_SECRET`) holding uid, email, status, admin and `checkedAt`. It lasts 30 days.
4. **`proxy.ts` on every request:**
   - **No session:** pages redirect to `/login?next=…` and API requests get 401.
   - **Status due for a re-check:** page loads detour through `/api/auth/refresh`, which re-reads `users/{uid}` and re-issues the cookie. That happens every 15 minutes for approved users and every 10 seconds for pending or rejected ones.
   - **Not approved:** the user is sent to `/pending`; API requests get 403.
   - **`/admin` without admin rights:** redirect to `/`.
5. **Approvals:** `/admin` lists users and approves, declines or revokes them with Server Actions. Each action re-checks the admin session itself.

### 4.3 Folder structure

```
.
├── src/
│   ├── proxy.ts                 # access gate for every request (Next 16 "proxy", formerly middleware)
│   ├── instrumentation.ts       # logs the Telegram bots in at server start (fast first play)
│   ├── app/
│   │   ├── layout.tsx           # <html>/<body>, font, metadata
│   │   ├── not-found.tsx        # 404 inside the app shell
│   │   ├── (app)/               # pages with sidebar + header (AppShell)
│   │   │   ├── (catalog)/       # /, /movies, /series, /categories, /watch/[id]  (shows "Firebase not configured" if keys missing)
│   │   │   ├── admin/           # /admin: approve viewers
│   │   │   ├── favorites/ videos/ reviews/ support/   # built, hidden from navigation
│   │   │   └── error.tsx
│   │   ├── (auth)/              # bare centred layout
│   │   │   ├── login/           # sign in / request access / reset password
│   │   │   └── pending/         # waiting for approval
│   │   └── api/
│   │       ├── auth/refresh/    # re-check approval, re-issue session
│   │       ├── media/           # catalog lists, search, details
│   │       ├── stream/[fileId]/ # video + thumbnail relay (byte ranges)
│   │       └── telegram/        # sync (pull) and webhook (push), secret-guarded
│   ├── components/
│   │   ├── layout/              # AppShell, Sidebar, Header, Logo, TmdbCredit, PathnameBoundary
│   │   └── ui/                  # Button, Pill, Badge, Modal, MediaImage, feedback (EmptyState, Skeleton…)
│   ├── features/                # UI by feature: auth, catalog, home, movies, series, categories,
│   │                            # favorites, media-detail (modal + MediaPlayer), search, watch
│   ├── hooks/                   # useApiQuery, useMedia, useFavorites, useCarousel, …
│   ├── services/
│   │   ├── auth/                # session token, Firebase Auth REST, users repository, actions, notify
│   │   ├── firebase/            # Web SDK (reads) and Admin SDK (writes)
│   │   ├── library/             # Firestore schema, cached repository, writer, TMDB enrichment, provider
│   │   ├── media/               # catalog.service.ts: the single entry point pages use
│   │   ├── telegram/            # caption parser, Bot API client, ingest + prune, MTProto client/stream, bot picker
│   │   ├── tmdb/                # TMDB client, mappers, genres
│   │   └── favorites/           # favorites store (browser localStorage)
│   ├── config/                  # site (feature flags), navigation, categories, catalog limits, image hosts
│   ├── types/  utils/
├── scripts/
│   ├── sync.mjs                 # pull new posts, backfill TMDB, prune deleted posts
│   ├── telegram-server.mjs      # webhook on/off, bot status
│   ├── load-test.mjs            # simulate N simultaneous viewers
│   └── prepare-videos.sh        # make files browser-ready with ffmpeg
├── deploy/
│   ├── Caddyfile                # HTTPS + streaming-friendly reverse proxy
│   └── push.sh                  # one-command deploy from the Mac
├── Dockerfile  docker-compose.yml  .dockerignore
├── .env.example                 # every setting, documented (copy to .env.local)
└── docs/PROJECT_GUIDE.md        # this file
```

**Layering rule:** pages call `services/media/catalog.service.ts`, which is the only place that talks to providers. Catalog reads go through `library/media.repository.ts` (Web SDK); writes go through `library/media.writer.ts` (Admin SDK). Category names are canonicalised in `config/categories.ts`.

### 4.4 Data model (Firestore)

**`media/{file_unique_id}`**: one document per uploaded file. The document id is Telegram's stable `file_unique_id`.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | From the caption, without the year |
| `type` | `"movie"` \| `"series"` | |
| `category` | string | Can hold several categories ("Animation, Comedy"). The first is the primary one; the others are merged into genres. |
| `releaseYear` | number \| null | From `Title (2015)` |
| `duration`, `durationSeconds` | string, number | e.g. `"1h 39m"`, `5940` |
| `seriesKey`, `season`, `episode`, `episodeTitle` | | Series only. `seriesKey` is the slug of the title; episodes group by it. |
| `telegramFileId`, `thumbnailFileId` | string | Used by `/api/stream/…` |
| `thumbnailUrl` | string \| null | Proxy URL of Telegram's thumbnail |
| `mimeType`, `fileSize` | | |
| `telegram` | `{ chatId, messageId }` | Where the post lives. MTProto streaming and deletion detection use it. |
| `tmdb` | object | `{ lookup, found, tmdbId, overview, posterUrl, backdropUrl, rating, voteCount, genres, releaseYear }` |
| `overview`, `posterUrl`, `backdropUrl`, `rating`, `genres` | optional | Values set by hand **override** TMDB |
| `createdAt`, `updatedAt` | timestamp | `createdAt` is the original post time and sets the "trending" order |

**`users/{uid}`**: one document per account.

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | Lower-case |
| `status` | `"pending"` \| `"approved"` \| `"rejected"` | |
| `createdAt`, `decidedAt` | timestamp | |

**`system/telegram`**: the pull-sync offset (`getUpdates`).

**Security rules** (published in the Firebase console, see [§5.2 F](#52-firebase-setup)):
- `media` is publicly readable and nobody can write it from a client.
- Everything else is private.

The server writes with the Admin SDK, which bypasses these rules. Note that catalog metadata (titles, but not videos) can therefore be read with the public Firebase web key.

### 4.5 Security model

| Layer | Protection |
| --- | --- |
| Transport | HTTPS only (Caddy + Let's Encrypt) |
| Every request | `proxy.ts` verifies the signed session cookie and its approval status |
| Server Actions | Re-check the session themselves (e.g. admin actions), so they don't rely on the proxy alone |
| Telegram endpoints | `TELEGRAM_SYNC_SECRET`: Bearer token for sync; Telegram's secret header for the webhook. Only posts from `TELEGRAM_CHANNEL_ID` / `TELEGRAM_ADMIN_IDS` are ingested. |
| Stream relay | Serves only files that are in the library |
| Credentials | Bot tokens, API hash, service account and `AUTH_SECRET` live only in `.env.local` (Mac) and `.env` (server). Both are git-ignored. |
| Cookie | `httpOnly`, `SameSite=Lax`, `Secure` in production, HMAC-SHA256 signed |
| Passwords | Handled by Firebase Auth. The app never stores them. |
| Server-side tools | `Authorization: Bearer $TELEGRAM_SYNC_SECRET` may call `/api/*` (the load test uses this) |
| Search engines | `public/robots.txt` disallows all |

---

## 5. Setting up the project from scratch

### 5.1 Prerequisites

- **macOS** (or Linux) with **Node.js 24** and npm.
- **Git.**
- **A Telegram account** (on your phone, plus <https://web.telegram.org> on the computer).
- **A Google account** for Firebase.
- **A TMDB account** (optional, free) for posters.
- **ffmpeg** (optional) for preparing videos: `brew install ffmpeg`.

```bash
git clone <repo-url> telegram-player
cd telegram-player
npm install
cp .env.example .env.local      # then fill it in using the steps below
```

> **Never commit `.env.local`.** It's already in `.gitignore`.

### 5.2 Firebase setup

**A. Create the project**
1. Go to <https://console.firebase.google.com> → **Add project**, name it, and finish. Google Analytics isn't needed.

**B. Create the Firestore database**
1. Open **Build → Firestore Database → Create database**.
2. Choose **production mode** and a location near your viewers, e.g. `asia-south1` (Mumbai). The location can't be changed later.

**C. Register a web app (for catalog reads and sign-in)**
1. Go to **Project settings** (gear icon) → **General → Your apps** → the **Web** icon (`</>`).
2. Give it a nickname. Firebase Hosting isn't needed. Click **Register app**.
3. Copy the values from the `firebaseConfig` it shows into `.env.local`:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

   These are public by design, and the security rules protect the data.

**D. Create a service account (for server writes)**
1. Go to **Project settings → Service accounts → Generate new private key**. A JSON file downloads.
2. Copy three values from it into `.env.local`:

   ```env
   FIREBASE_PROJECT_ID=<project_id>
   FIREBASE_CLIENT_EMAIL=<client_email>
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
   ```

   Keep the private key **on one line** with literal `\n` sequences, inside double quotes.
3. **Delete the downloaded JSON file** afterwards, or keep it outside the project. Files named like `*-firebase-adminsdk-*.json` are git-ignored as a safety net.

**E. Turn on email sign-in**
1. Go to **Build → Authentication → Get started → Sign-in method**.
2. Choose **Email/Password → Enable → Save**. Leave "Email link" off.
3. Optional: under **Templates → Password reset**, customise the reset email.

**F. Publish the security rules (in the console)**

1. Go to **Build → Firestore Database → Rules**.
2. Replace everything in the editor with the rules below, then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public, read-only catalog. The app reads it with the Web SDK using the
    // NEXT_PUBLIC_FIREBASE_* keys. The server writes via the Admin SDK, which
    // bypasses these rules, so no client can ever write here.
    match /media/{docId} {
      allow read: if true;
      allow write: if false;
    }

    // Everything else (users/{uid} approvals, system/telegram sync state) is
    // private: only the server's Admin SDK touches it.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The project doesn't keep a `firestore.rules` file. The Firebase console is the source of truth, and this copy is for reference.

**G. Session secret and admin**

```env
AUTH_SECRET=<output of: openssl rand -base64 48>
ADMIN_EMAILS=you@example.com          # your sign-in email; comma-separate several
```

### 5.3 Telegram setup

**A. Main bot**
1. In Telegram, open **@BotFather** and send `/newbot`. Choose a display name and a username ending in `bot`.
2. Copy the token into `.env.local` as `TELEGRAM_BOT_TOKEN=123456:AA...`.

**B. Private channel**
1. In Telegram, choose **New Channel** and make it **Private**. This is where you'll upload videos.
2. In the channel, open **Administrators → Add Admin** and add your bot. The default rights are fine.

**C. Find the channel id**
1. Open the channel at <https://web.telegram.org/a/>. The address bar ends with the id, e.g. `#-1001234567890`.
2. Put it in `.env.local`:

   ```env
   TELEGRAM_CHANNEL_ID=-1001234567890
   ```

   The id starts with `-100`.

**D. Sync secret**

```env
TELEGRAM_SYNC_SECRET=<random letters/digits/_/->      # e.g. openssl rand -hex 32
```

It protects `/api/telegram/sync` and the webhook.

**E. MTProto credentials (needed for files over 20 MB, i.e. all movies)**
1. Sign in at <https://my.telegram.org> with your phone number.
2. Open **API development tools** and create an app. Any title and short name work.
3. Copy the values into `.env.local`:

   ```env
   TELEGRAM_API_ID=1234567
   TELEGRAM_API_HASH=0123456789abcdef0123456789abcdef
   ```

**F. Helper bots (more simultaneous viewers)**

Each bot can stream to about 3 viewers at once.

1. Create **3 more bots** with `/newbot`, for 4 in total.
2. Add each one as an **admin of the channel**.
3. List their tokens, comma-separated:

   ```env
   TELEGRAM_STREAM_BOT_TOKENS=111:AAA...,222:BBB...,333:CCC...
   ```

4. Check them: `npm run telegram -- status`. Every bot should show **✔ channel admin**.

**G. Admin notifications (optional)**
1. Message **@userinfobot** in Telegram. It replies with your numeric **Id**.
2. Put it in `.env.local` as `TELEGRAM_ADMIN_IDS=<your id>`.
3. Open a **private chat with your main bot** (search its username) and press **Start**. Bots can't DM you until you've done this.

From then on the bot DMs you when someone requests access. Note that videos you send directly to the bot are also accepted, but **always upload through the channel**. Only channel posts can be streamed by all the helper bots; see [§6.6](#66-limits-and-rules).

**H. Optional tuning**

```env
TELEGRAM_STREAM_READAHEAD_MB=8    # how far ahead to fetch per viewer (8 MB ≈ 30 s of a 1.5 GB film)
TELEGRAM_STREAM_PARALLEL=2        # parallel Telegram requests per viewer
```

### 5.4 TMDB setup (optional, recommended)

1. Create an account at <https://www.themoviedb.org>.
2. Go to **Settings → API**, request an API key (personal use), and copy the **API Read Access Token**:

   ```env
   TMDB_ACCESS_TOKEN=eyJhbGciOi...
   # or the v3 key instead:
   TMDB_API_KEY=...
   ```

### 5.5 Run it locally

```bash
npm run dev                     # http://localhost:3000
npm run telegram -- status      # bots and webhook state
npm run sync                    # import channel posts (only while no webhook is set)
```

1. Open <http://localhost:3000>. You'll be redirected to **/login**.
2. Choose **Request access** and sign up with your `ADMIN_EMAILS` address. You're approved automatically.
3. If the catalog is empty, post a video (see [§6](#6-uploading-movies-and-series)) and run `npm run sync`.

> **Pull vs push:** locally, new posts are fetched with `npm run sync` (pull). In production a webhook pushes them (push). While the webhook is set, local `npm run sync` reports "webhook active" and only backfills posters and prunes deletions. To pull locally again, run `npm run telegram -- delete-webhook`. Telegram keeps undelivered updates for only **24 hours**.

---

## 6. Uploading movies and series

### 6.1 Prepare the files (recommended)

Browsers play **MP4 (H.264 or HEVC video, AAC audio)** reliably. MKV, AC-3 or DTS audio and some other formats don't play in browsers. Fix files before uploading:

```bash
brew install ffmpeg                                  # once
npm run prepare-videos -- ~/Downloads/Brickleberry   # a folder of videos
```

The script writes browser-ready copies to `<folder>/ready/` and never touches the originals:
- **HEVC video** is kept as is, tagged `hvc1` so Safari and iPhone can play it.
- **H.264** is kept as is.
- **Other video codecs** are re-encoded with x264 at CRF 20 (near-lossless).
- **AAC audio** is kept. AC-3, DTS and similar formats become AAC 192k.
- **The file index moves to the front** ("faststart"), so playback starts quickly.
- **MKV, MOV and AVI become MP4.**
- **Re-running** skips files that are already finished.

### 6.2 Post to the channel

1. Open the **channel** in Telegram (desktop is easiest for big files).
2. Attach the video **as a file/document**, not as a "video".
   - **Telegram Desktop:** drag the file in and untick **"Compress"** (or "Send as file").
   - **Phone:** 📎 → **File**, then choose the video.

   Sending as a "video" makes Telegram recompress it and lose quality.
3. Write the **caption** in the format below and send.
4. The title appears in the app within a few seconds.

### 6.3 Caption format

```
Title (Year) | Type | Category[, Category…] | Duration | SxxEyy | Episode title
```

| Part | Required | Rules |
| --- | --- | --- |
| `Title` | **yes** | First field. Add the year in brackets, `(2015)`; it makes the TMDB match much more accurate. |
| `Type` | **yes** | Second field. `Movie` (or `Film`) / `Series` (or `TV`, `Show`, `Episode`). Not case-sensitive. |
| `Category` | no | Several are allowed, separated by `,` `/` or `&`. The first is the primary category. Aliases are recognised: `Sci Fi` / `Science Fiction` → Sci-Fi, `Anime` / `Cartoon` → Animation, `Rom-Com` → Romance, `Suspense` → Thriller, `Docs` → Documentary. Default: Uncategorized. |
| `Duration` | no | `1h 39m`, `2h`, `45m`, `45 min` |
| `SxxEyy` | series | Season and episode, e.g. `S01E01`, `S2E10` |
| `Episode title` | no | Series only; any text after the other fields |

- Fields after the type can appear **in any order**.
- Only the **first caption line containing `|`** is read, so you can add other notes on other lines.
- Captions that can't be parsed are **skipped**, and the sync report says why.

**Known categories:** Action, Comedy, Drama, Romance, Animation, Sci-Fi, Fantasy, Thriller, Horror, Adventure, Crime, Mystery, Documentary, Family. Other names work too; they're title-cased.

### 6.4 Examples

**Movie**
```
Vacation (2015) | Movie | Comedy, Adventure | 1h 39m
```

**Series episodes.** Use **exactly the same title and year on every episode**; that's how episodes are grouped into one series.
```
Brickleberry (2012) | Series | Animation, Comedy | 22m | S01E01
Brickleberry (2012) | Series | Animation, Comedy | 22m | S01E02 | Two Weeks Notice
Brickleberry (2012) | Series | Animation, Comedy | 22m | S02E01
```

**Minimal**
```
Inception (2010) | Movie
```

### 6.5 Editing, replacing and deleting

| You want to… | Do this |
| --- | --- |
| Fix a title, category or episode number | **Edit the caption** of the post in Telegram. The webhook updates the same entry. |
| Replace the video file | Edit the post and replace the media. The entry keeps its place with the new file. |
| Remove a title | **Delete the post**, then run sync ([§7.3](#73-sync-pull-posts-backfill-posters-prune-deletions)). Telegram doesn't report deletions, so the sync's prune step checks which posts still exist. |
| Change a poster or synopsis by hand | In the Firebase console, set `posterUrl`, `overview`, `rating` or `genres` on the `media` doc. Values set by hand override TMDB. Changes show up within an hour. |
| Re-run TMDB for a title | Change its title or year in the caption; TMDB is only looked up again when those change. Run sync to backfill anything missing. |

### 6.6 Limits and rules

- **Size:** up to **2 GB** per file, or **4 GB** with Telegram Premium.
- **Upload through the channel only.** Streaming uses the channel post, which all 4 bots can read. Videos sent straight to the bot can only be streamed by the main bot, which limits them to about 3 viewers.
- **Safety valves on pruning:** the prune step skips a channel if every post in it looks missing, and refuses to remove more than half the library at once. This protects the catalog if a bot loses admin rights.

---

## 7. Scripts and commands

### 7.1 npm scripts (run on the Mac, in the project folder)

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on <http://localhost:3000> |
| `npm run build` | Production build (`.next/standalone`) |
| `npm start` | Run the production build locally |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run sync` | Pull new posts, backfill TMDB, prune deleted posts (see [§7.3](#73-sync-pull-posts-backfill-posters-prune-deletions)) |
| `npm run telegram -- status` | Webhook state, pending updates, and whether each bot is a channel admin |
| `npm run telegram -- set-webhook` | Make Telegram push new posts to `https://$APP_DOMAIN/api/telegram/webhook` |
| `npm run telegram -- delete-webhook` | Switch back to pull mode (`npm run sync`) |
| `npm run prepare-videos -- <folder>` | Make videos browser-ready (ffmpeg) |

### 7.2 Telegram helper (`scripts/telegram-server.mjs`)

```bash
npm run telegram -- status            # on the Mac (reads .env.local)
docker compose exec app node scripts/telegram-server.mjs status        # on the server
docker compose exec app node scripts/telegram-server.mjs set-webhook
docker compose exec app node scripts/telegram-server.mjs delete-webhook
```

### 7.3 Sync: pull posts, backfill posters, prune deletions

`scripts/sync.mjs` calls `POST /api/telegram/sync` with `Authorization: Bearer $TELEGRAM_SYNC_SECRET`. It does three things:

1. **Pulls** pending posts via `getUpdates`. This only works while no webhook is set; otherwise it reports "webhook active" and skips this step.
2. **Backfills** TMDB data for any title still missing it.
3. **Prunes** titles whose Telegram post was deleted.

```bash
npm run sync                                   # Mac, against the local app
npm run sync -- --url https://tplayer.ccodes.in   # Mac, against production
# on the server (inside telegram-player/):
docker compose exec app node scripts/sync.mjs --url http://localhost:3000
```

### 7.4 Load test (`scripts/load-test.mjs`)

The load test simulates N people watching the largest movie at once, at different points in the film, and reports whether each would play smoothly.

```bash
# on the server (most realistic):
docker compose exec app node scripts/load-test.mjs 10
# on the Mac against the local app (your home internet will be the bottleneck):
node --env-file=.env.local scripts/load-test.mjs 10 http://localhost:3000
```

### 7.5 Deploy (`deploy/push.sh`, on the Mac)

```bash
deploy/push.sh            # copy code, rebuild, restart (server = DEPLOY_HOST in .env.local)
deploy/push.sh --env      # same, and replace the server's .env with .env.local
deploy/push.sh ubuntu@1.2.3.4   # deploy to a different server
```

It uses the SSH key `~/.ssh/oracle_tplayer` (override with `SSH_KEY=…`).

### 7.6 Docker on the server (inside `~/telegram-player`)

| Command | What it does |
| --- | --- |
| `docker compose ps` | Container status |
| `docker compose logs -f app` | App logs (`caddy` for HTTPS logs) |
| `docker compose restart` | Restart both containers |
| `docker compose up -d --build` | Rebuild and start (what `push.sh` runs) |
| `docker compose down` | Stop everything |

### 7.7 Firebase

Firebase is managed entirely in the web console (<https://console.firebase.google.com>), and the project contains no Firebase CLI files:

| Task | Where in the console |
| --- | --- |
| Security rules | Firestore Database → Rules ([§5.2 F](#52-firebase-setup)) |
| See or edit catalog entries | Firestore Database → Data → `media` |
| See approvals | Firestore Database → Data → `users` (approve at `/admin` instead) |
| Sign-in accounts, password resets | Authentication → Users |
| Service-account key | Project settings → Service accounts |

**Optional local emulators (advanced testing only):**
1. Run them with `npx firebase-tools emulators:start --only firestore,auth --project <project-id> --config <path/to/firebase.json>`. Keep that `firebase.json` **outside the project**, with `"emulators": { "auth": { "port": 9099 }, "firestore": { "port": 8080 } }`.
2. Set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` in `.env.local`.
3. Remove both variables again for normal use.

---

## 8. Deploying to a server

The production setup is one small server running two containers (`docker-compose.yml`):

| Service | Role |
| --- | --- |
| `app` | This Next.js app (`Dockerfile`, multi-stage, `node:24-alpine`). It also relays video from Telegram. |
| `caddy` | HTTPS with automatic Let's Encrypt certificates (`deploy/Caddyfile`) |

**Traffic is what counts**, not CPU or disk: one 1.5 GB movie watched by 10 people is about 15 GB.

### 8.1 Create the server (Oracle Cloud Always Free)

1. Sign up at <https://signup.cloud.oracle.com/>.
   - Choose the **Home Region** carefully, e.g. India West (Mumbai) or India South (Hyderabad). It can't be changed, and free servers only run there.
   - The card check is a small temporary charge.
2. **Create the network first** (this guarantees a public IP):
   1. Go to **☰ → Networking → Virtual cloud networks → Start VCN Wizard → Create VCN with Internet Connectivity**.
   2. Name it `tplayer-vcn`, keep the defaults, and click **Create**.
3. **Create the server:**
   1. Go to **☰ → Compute → Instances → Create instance**.
   2. **Name:** `tplayer`.
   3. **Image:** Canonical Ubuntu 24.04.
   4. **Shape:** Ampere `VM.Standard.A1.Flex`, 2 OCPU, 12 GB.
   5. **Networking:** select the existing VCN `tplayer-vcn` and its **public subnet**, and turn on **Automatically assign public IPv4 address**.
   6. **SSH keys:** choose **Paste public keys**. Create the key on the Mac and copy it:
      ```bash
      ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/oracle_tplayer
      pbcopy < ~/.ssh/oracle_tplayer.pub
      ```
   7. Click **Create**. If it says "Out of capacity", change **Placement** to another availability domain, or retry later.
4. Copy the **Public IP address** from the instance page.
5. **Open ports 80 and 443:**
   1. Go to **Networking → Virtual cloud networks → tplayer-vcn → Security → Default Security List → Security rules → Add Ingress Rules**.
   2. Add two rules with source `0.0.0.0/0` and protocol TCP: one for destination port `80`, one for `443`.
6. **Recommended:** upgrade the account to **Pay As You Go** under Billing. That stops Oracle from reclaiming "idle" free servers, and it stays free within the Always Free limits.

**Alternative:** Hetzner Cloud CX22 (~€4/month, x86, 20 TB traffic). The steps from §8.3 on are the same.

### 8.2 Point the domain at the server (GoDaddy)

1. Go to **godaddy.com → My Products → ccodes.in → DNS → Add New Record**.
2. Fill it in: **Type** `A`, **Name** `tplayer`, **Value** `<server IP>`, **TTL** ½ hour. Save.
3. Check it from the Mac: `dig +short tplayer.ccodes.in` should print the server IP. This usually takes 5–30 minutes.

HTTPS can only be issued once the name points at the server, and the Telegram webhook requires HTTPS.

### 8.3 Prepare the server (once)

```bash
ssh -i ~/.ssh/oracle_tplayer ubuntu@<server-ip>
# Oracle's Ubuntu image also blocks 80/443 in its own firewall:
sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443 -j ACCEPT && sudo netfilter-persistent save
# Docker:
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ubuntu
exit
```

### 8.4 Deploy

1. In `.env.local` on the Mac:
   ```env
   DEPLOY_HOST=ubuntu@<server-ip>
   DEPLOY_DOMAIN=tplayer.ccodes.in
   ```
2. Deploy:
   ```bash
   deploy/push.sh
   ```
   The first run:
   - copies the code (without `node_modules`, `.next`, `.git` or env files)
   - creates the server's `~/telegram-player/.env` from `.env.local`, removing local-only settings and adding `APP_DOMAIN`
   - builds the image on the server, which takes about 3–5 minutes the first time
   - starts both containers
3. On the server, turn on push uploads and check everything:
   ```bash
   ssh -i ~/.ssh/oracle_tplayer ubuntu@<server-ip>
   cd telegram-player
   docker compose exec app node scripts/telegram-server.mjs set-webhook
   docker compose exec app node scripts/telegram-server.mjs status
   docker compose exec app node scripts/load-test.mjs 10
   ```
4. Open `https://tplayer.ccodes.in` and sign up with your admin email.

---

## 9. Day-to-day operations

| Task | How |
| --- | --- |
| Add a movie or episode | Post it to the channel with a caption ([§6](#6-uploading-movies-and-series)) |
| Approve a new viewer | Open `https://tplayer.ccodes.in/admin` (you also get a Telegram DM) and click **Approve**. They get in when they press "Check again". |
| Remove a viewer | `/admin` → **Revoke**. They're locked out within 15 minutes. |
| Remove a title | Delete the post, then on the server run `docker compose exec app node scripts/sync.mjs --url http://localhost:3000` (or `npm run sync -- --url https://tplayer.ccodes.in` from the Mac) |
| Deploy code changes | `deploy/push.sh` |
| Change settings | Edit `.env.local`, then run `deploy/push.sh --env` |
| See errors | On the server: `docker compose logs -f app` |
| Check capacity | `docker compose exec app node scripts/load-test.mjs 10` |
| Viewers report buffering | Add helper bots ([§5.3 F](#53-telegram-setup)), or raise `TELEGRAM_STREAM_READAHEAD_MB` / `TELEGRAM_STREAM_PARALLEL`, then run `deploy/push.sh --env` |
| HTTPS certificate | Renews automatically (Caddy) |

---

## 10. Troubleshooting

| Symptom | Likely cause → fix |
| --- | --- |
| "Firebase not configured" screen | `NEXT_PUBLIC_FIREBASE_*` missing → fill them in and restart or redeploy. These values are baked in at build time. |
| "No data" screen | The catalog is empty → post a video, then sync or check the webhook |
| "Sign-in is not configured: set AUTH_SECRET" | `AUTH_SECRET` is missing or shorter than 32 characters |
| "Email sign-in isn't enabled for this app yet" | Turn on Email/Password in Firebase Authentication ([§5.2 E](#52-firebase-setup)) |
| A new post doesn't appear | Check the caption against [§6.3](#63-caption-format). Check the webhook with `telegram-server.mjs status`; "Pending" updates should be 0. Make sure the bot is still a channel admin. |
| The video doesn't play: "larger than 20 MB" | `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` aren't set |
| Video plays in Chrome but not in Safari/iPhone | Run `prepare-videos` (HEVC needs the `hvc1` tag) |
| No sound or black screen | Unsupported codec (AC-3/DTS audio, MKV) → run `prepare-videos` |
| Buffering with several viewers | Add helper bots and run `status` to check each one is a channel admin |
| `npm run sync` says "webhook active" | Expected while production uses the webhook. Run `delete-webhook` to pull locally. |
| Sign-up DM doesn't arrive | Your id must be in `TELEGRAM_ADMIN_IDS`, and you must have pressed **Start** in a private chat with the main bot |
| A deleted post still shows | Run sync; deletions are only detected by sync's prune step |
| Site unreachable after creating the server | Check: the ports 80/443 ingress rules, the server's iptables rule, and that the DNS A record matches the server IP |
| Logs show "Server Reference ID did not match…" | Bots probing the site with bogus requests; harmless |

---

## 11. Development notes and gotchas

This is **Next.js 16**, so APIs differ from older versions. Read `node_modules/next/dist/docs/` before using an API.

- **Proxy (formerly middleware)** lives in `src/proxy.ts` and runs on Node.js.
  - Its redirects must use **absolute** URLs (`new URL(path, request.nextUrl)`); Next turns same-origin ones into a relative `Location` header.
- **Route handlers** see the server's own host in `request.url` (e.g. `localhost:3000` behind Caddy), so they redirect with a **relative** `Location` header (`relativeRedirect` in `services/auth/redirect.ts`).
- **`next/image`:** the optimizer fetches local images **without the viewer's cookie**, so Telegram thumbnails (`/api/stream/…`) load `unoptimized`. Also use `preload`, not `priority`.
- **Cache Components:**
  - Navigating away **hides** the page (React `<Activity>`) rather than unmounting it, so media must be paused in a layout-effect cleanup (see `MediaPlayer.tsx`).
  - Reading the session (`cookies()`) must happen inside `<Suspense>`.
  - Invalidate the catalog with `revalidateTag("catalog", { expire: 0 })`.
  - Inside Server Actions, use `refresh()` from `next/cache`.
- **Route handlers** must call `unstable_rethrow(error)` in catch blocks (see `utils/route.ts`).
- **`error.tsx`** receives `retry`, not `reset`.
- **`usePathname` / `useSearchParams` in dynamic routes** need a Suspense boundary (see `PathnameBoundary`).
- **Crossing the server/client boundary:** pass rendered `<Icon/>` elements, not component functions.
- **GramJS:**
  - Import only from the `"telegram"` package root. Sub-path imports bundle a second copy, which causes "Only StringSession supported".
  - Never use `iterDownload`; the code has its own `GetFile` loop.
  - Bot logins are staggered 500 ms apart to avoid "invalid new nonce hash".
- **`instrumentation.ts`** skips the build phase and non-Node runtimes.
- **Only one `next dev` per folder.** For a second instance, run the standalone build: `PORT=3100 node .next/standalone/server.js`.
- **Docker on arm64:** the deps stage installs `python3 make g++`, because native addons (`bufferutil`) have no prebuilt Alpine/arm64 binaries.
- **Before committing:** run `npx tsc --noEmit && npm run lint && npm run build`.

---

## 12. Environment variable reference

All settings live in `.env.local` (copy `.env.example`). The server's `.env` is generated from it by `deploy/push.sh`. **Both are git-ignored.**

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` … `NEXT_PUBLIC_FIREBASE_APP_ID` (6 keys) | **yes** | Firebase web config: catalog reads and sign-in. Inlined at build time. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | **yes** | Admin SDK: catalog writes, viewer approvals |
| `AUTH_SECRET` | **yes** | Signs session cookies (32+ characters) |
| `ADMIN_EMAILS` | **yes** | Auto-approved admin account(s) |
| `TELEGRAM_BOT_TOKEN` | **yes** | Main bot: ingestion, thumbnails, streaming |
| `TELEGRAM_CHANNEL_ID` | **yes** | The upload channel (`-100…`) |
| `TELEGRAM_SYNC_SECRET` | **yes** | Guards sync and the webhook; service token for server tools |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | **yes** (for files > 20 MB) | MTProto streaming |
| `TELEGRAM_STREAM_BOT_TOKENS` | recommended | Helper bots, comma-separated |
| `TELEGRAM_ADMIN_IDS` | optional | Your Telegram user id: sign-up DMs |
| `TELEGRAM_STREAM_READAHEAD_MB`, `TELEGRAM_STREAM_PARALLEL` | optional | Streaming tuning (defaults 8 and 2) |
| `TMDB_ACCESS_TOKEN` or `TMDB_API_KEY` | optional | Posters, synopses, ratings |
| `NEXT_PUBLIC_STREAM_BASE_URL` | optional | Serve video from another origin (default: this app's `/api/stream`) |
| `NEXT_PUBLIC_PREVIEW_STREAM_URL` | optional | Clip for placeholder file ids |
| `APP_DOMAIN` | server only | Public domain, used by Caddy and the webhook. Leave it empty locally; `push.sh` sets it. |
| `DEPLOY_HOST`, `DEPLOY_DOMAIN` | Mac only | Used by `deploy/push.sh`; never sent to the server |
| `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` | tests only | Local emulators; never set in production |
| `TELEGRAM_API_BASE`, `TMDB_API_BASE` | tests only | Point at fake servers; never set in production |
