# Telegram Player

A private, Netflix-style streaming site for a small group of viewers.

- **Videos are stored in a private Telegram channel.** The server streams only the part being watched over MTProto, at full quality, and stores nothing.
- **Firestore holds the catalog.** It fits in the free tier.
- **TMDB adds posters and synopses.**
- **Viewers need an approved account.** They sign up with email and password, and the owner approves each one at `/admin`.

**Stack:** Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS v4, Firebase (Firestore + Auth), Telegram Bot API + GramJS, TMDB, Docker + Caddy on Oracle Cloud.

**Production:** <https://tplayer.ccodes.in>

## Documentation

**[docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md)** is the complete guide:
- features and requirements
- tech stack and architecture
- Firebase and Telegram setup
- caption format for movies and series
- every script and command
- deployment and troubleshooting

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in: see the guide, §5
npm run dev                  # http://localhost:3000
```

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run sync` | Import channel posts, backfill posters, prune deleted posts |
| `npm run telegram -- status` | Check the bots and the webhook |
| `npm run prepare-videos -- <folder>` | Make videos browser-ready (needs ffmpeg) |
| `deploy/push.sh [--env]` | Deploy to the server |
| `npx tsc --noEmit && npm run lint` | Type-check and lint |

## Uploading

Post the video **as a file** to the channel, with a caption like this:

```
Vacation (2015) | Movie | Comedy, Adventure | 1h 39m
Brickleberry (2012) | Series | Animation, Comedy | 22m | S01E01 | Episode title
```

The guide's §6 has the full caption rules.
