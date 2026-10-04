#!/bin/bash
# Deploy (or redeploy) STAGING next to prod on the same droplet.
#   - code:     /var/www/kountryeye-staging  (git branch, default "staging")
#   - backend:  127.0.0.1:8001  (systemd: kountryeye-staging)
#   - site:     http://SERVER_IP:8080        (nginx: kountryeye-staging)
#   - data:     its own copy of the prod DB + uploads (see refresh-staging-db.sh)
# Prod (/var/www/kountryeye, port 80/8000) is only read, never modified.
#
# Usage: sudo bash deploy-staging.sh [branch]        first run also clones the prod DB
#        sudo REFRESH_DB=1 bash deploy-staging.sh    redeploy + re-clone prod data
#        sudo SKIP_FRONTEND_BUILD=1 bash deploy-staging.sh   frontend built locally, then:
#          scp -r frontend-chakra/dist/* root@SERVER:/var/www/kountryeye-staging/frontend-dist/
set -euo pipefail

BRANCH=${1:-staging}
PROD=/var/www/kountryeye
STAGING=/var/www/kountryeye-staging
PORT=8080

command -v rsync >/dev/null || apt-get install -y rsync

# --- Code ---
if [ -d "$STAGING/.git" ]; then
  git -C "$STAGING" fetch origin "$BRANCH"
  git -C "$STAGING" checkout -B "$BRANCH" "origin/$BRANCH"
else
  REPO_URL=${REPO_URL:-$(git -C "$PROD" remote get-url origin 2>/dev/null || echo https://github.com/freddiequinson/KountryEye.git)}
  git clone --branch "$BRANCH" "$REPO_URL" "$STAGING"
fi
SRC="$STAGING/deployment/staging"   # use the scripts from the deployed branch

# --- Backend ---
cd "$STAGING/backend"
[ -d venv ] || python3 -m venv venv
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q -r requirements.txt
# Match prod's exact package versions (it has packages installed by hand).
[ -x "$PROD/backend/venv/bin/pip" ] && "$PROD/backend/venv/bin/pip" freeze | venv/bin/pip install -q -r /dev/stdin

ENV="$STAGING/backend/.env"
if [ ! -f "$ENV" ]; then
  # Start from prod's settings (AI keys etc.), then override what must differ.
  [ -f "$PROD/backend/.env" ] && cp "$PROD/backend/.env" "$ENV" || touch "$ENV"
  set_env() { sed -i "/^$1=/d" "$ENV"; echo "$1=$2" >> "$ENV"; }
  # Different secret: prod logins/tokens and staging ones never mix.
  set_env SECRET_KEY "$(openssl rand -hex 32)"
  set_env DATABASE_URL "sqlite+aiosqlite:///$STAGING/backend/data/kountry_eyecare.db"
  set_env FRONTEND_URL "http://$(curl -s ifconfig.me):$PORT"
  set_env PROJECT_NAME "Kountry Eyecare (STAGING)"
  echo "Created $ENV (SMTP copied from prod if it was set there)."
fi
mkdir -p data uploads
chown -R www-data:www-data "$STAGING/backend/data" "$STAGING/backend/uploads" "$ENV"

# --- Frontend (new Chakra UI) ---
# SKIP_FRONTEND_BUILD=1: build locally and upload dist/ to $STAGING/frontend-dist
# instead (the 1GB droplet can run out of memory building it).
mkdir -p "$STAGING/frontend-dist"
if [ "${SKIP_FRONTEND_BUILD:-0}" != 1 ]; then
  cd "$STAGING/frontend-chakra"
  npm ci --no-audit --no-fund
  npm run build
  rsync -a --delete dist/ "$STAGING/frontend-dist/"
fi

# --- Service + nginx (separate files; prod's are untouched) ---
cp "$SRC/kountryeye-staging.service" /etc/systemd/system/
cp "$SRC/nginx-staging.conf" /etc/nginx/sites-available/kountryeye-staging
ln -sf /etc/nginx/sites-available/kountryeye-staging /etc/nginx/sites-enabled/kountryeye-staging
nginx -t
systemctl daemon-reload
systemctl enable kountryeye-staging >/dev/null

if ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow "$PORT/tcp"; fi

# --- Data: clone prod on first deploy or when asked ---
if [ ! -f "$STAGING/backend/data/kountry_eyecare.db" ] || [ "${REFRESH_DB:-0}" = 1 ]; then
  bash "$SRC/refresh-staging-db.sh"
else
  systemctl restart kountryeye-staging
fi
systemctl reload nginx

sleep 2
curl -fsS "http://127.0.0.1:8001/health" >/dev/null && echo "Staging backend: OK" || echo "Staging backend not answering - check: journalctl -u kountryeye-staging -n 50"
echo "Staging: http://$(curl -s ifconfig.me):$PORT  (branch $BRANCH)"
