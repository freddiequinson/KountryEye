#!/bin/bash
# Copy the live prod database + uploads into staging. Prod is only READ.
# Safe to run while prod is serving: uses SQLite's online backup API.
# Usage: sudo bash deployment/staging/refresh-staging-db.sh
set -euo pipefail

PROD=/var/www/kountryeye
STAGING=/var/www/kountryeye-staging

# Find the prod DB the same way the app does: DATABASE_URL in .env, else backend/data/.
url=$(grep -E '^DATABASE_URL=' "$PROD/backend/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)
db=${url#sqlite+aiosqlite:///}
if [ -z "$url" ]; then
  PROD_DB="$PROD/backend/data/kountry_eyecare.db"
elif [[ "$db" = /* ]]; then
  PROD_DB="$db"
else
  PROD_DB="$PROD/backend/${db#./}"
fi
STAGING_DB="$STAGING/backend/data/kountry_eyecare.db"

[ -f "$PROD_DB" ] || { echo "Prod DB not found at $PROD_DB - aborting"; exit 1; }
[ "$(realpath "$PROD_DB")" != "$(realpath -m "$STAGING_DB")" ] || { echo "Refusing: staging DB path equals prod"; exit 1; }

echo "Prod DB:    $PROD_DB"
echo "Staging DB: $STAGING_DB"

systemctl stop kountryeye-staging 2>/dev/null || true
mkdir -p "$(dirname "$STAGING_DB")"
tmp="$STAGING_DB.tmp"
rm -f "$tmp"
python3 - "$PROD_DB" "$tmp" <<'PY'
import sqlite3, sys
src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
assert dst.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "copy failed integrity check"
print("users:", dst.execute("SELECT COUNT(*) FROM users").fetchone()[0])
dst.close(); src.close()
PY
rm -f "$STAGING_DB-wal" "$STAGING_DB-shm"
mv "$tmp" "$STAGING_DB"

echo "Copying uploads..."
mkdir -p "$STAGING/backend/uploads"
rsync -a --delete "$PROD/backend/uploads/" "$STAGING/backend/uploads/"

chown -R www-data:www-data "$STAGING/backend/data" "$STAGING/backend/uploads"
systemctl start kountryeye-staging
echo "Staging DB refreshed from prod at $(date)."
