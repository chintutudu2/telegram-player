#!/usr/bin/env bash
# Deploy from this Mac to the server (see docs/PROJECT_GUIDE.md §8).
#
#   deploy/push.sh                     copy code, (re)build, restart
#   deploy/push.sh --env               also replace the server's .env
#   deploy/push.sh ubuntu@1.2.3.4      deploy to another server
#
# The server defaults to DEPLOY_HOST in .env.local (e.g. ubuntu@<server-ip>),
# so the address stays out of git. The first run creates the server's .env from
# .env.local (minus local-only settings) plus APP_DOMAIN. Later runs leave it
# alone unless --env is given.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "✖ .env.local not found"; exit 1; }

local_value() { grep -E "^$1=" .env.local | tail -1 | cut -d= -f2- | tr -d '"' || true; }

HOST="" PUSH_ENV=""
for arg in "$@"; do
  case "$arg" in
    --env) PUSH_ENV="--env" ;;
    *) HOST="$arg" ;;
  esac
done
HOST="${HOST:-$(local_value DEPLOY_HOST)}"
[ -n "$HOST" ] || { echo "✖ Set DEPLOY_HOST=ubuntu@<server-ip> in .env.local (or pass it as an argument)."; exit 1; }
DOMAIN="${APP_DOMAIN:-$(local_value DEPLOY_DOMAIN)}"
DOMAIN="${DOMAIN:-tplayer.ccodes.in}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oracle_tplayer}"
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=15)
grep -qE '^ADMIN_EMAILS=.+' .env.local || { echo "✖ Set ADMIN_EMAILS in .env.local first (your sign-in email)."; exit 1; }
grep -qE '^AUTH_SECRET=.{32,}' .env.local || { echo "✖ Set AUTH_SECRET in .env.local first (openssl rand -base64 48)."; exit 1; }

echo "→ Copying code to $HOST:telegram-player/"
rsync -az --delete -e "${SSH[*]}" \
  --exclude node_modules --exclude .next --exclude .git --exclude '.env*' \
  ./ "$HOST:telegram-player/"

if [ "$PUSH_ENV" = "--env" ] || ! "${SSH[@]}" "$HOST" test -f telegram-player/.env; then
  echo "→ Writing the server's .env (APP_DOMAIN=$DOMAIN)"
  {
    grep -vE '^(FIRESTORE_EMULATOR_HOST|FIREBASE_AUTH_EMULATOR_HOST|TELEGRAM_API_BASE|TMDB_API_BASE|APP_DOMAIN|DEPLOY_HOST|DEPLOY_DOMAIN)=' .env.local
    echo "APP_DOMAIN=$DOMAIN"
  } | "${SSH[@]}" "$HOST" 'umask 077 && cat > telegram-player/.env'
fi

echo "→ Building and starting (the first build takes a few minutes)"
"${SSH[@]}" "$HOST" 'cd telegram-player && docker compose up -d --build && docker image prune -f >/dev/null'
echo "✔ Deployed: https://$DOMAIN"
