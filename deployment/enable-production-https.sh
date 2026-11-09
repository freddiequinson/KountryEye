#!/usr/bin/env bash
# Enable trusted HTTPS for the production IP while retaining HTTP access.
# Requires root; uses an isolated Certbot install and automatic short-lived renewal.
set -euo pipefail
production_ip="${1:?Usage: enable-production-https.sh PUBLIC_IP}"
python3 - "$production_ip" <<'PY'
import ipaddress,sys
ipaddress.ip_address(sys.argv[1])
PY
app_root=/var/www/kountryeye
certbot_env=/opt/kountryeye-certbot
if [ ! -x "$certbot_env/bin/certbot" ]; then
  python3 -m venv "$certbot_env"
  "$certbot_env/bin/pip" install 'certbot>=5.4,<6'
fi
"$certbot_env/bin/certbot" certonly --non-interactive --agree-tos \
  --register-unsafely-without-email --preferred-profile shortlived \
  --webroot --webroot-path "$app_root/frontend-dist" \
  --ip-address "$production_ip" --cert-name kountryeye-production-ip \
  --keep-until-expiring
python3 - <<'PY'
from pathlib import Path
from datetime import datetime,timezone
import shutil,subprocess
config=Path('/etc/nginx/sites-enabled/kountryeye').resolve()
backup=Path('/var/backups/kountryeye')/('https-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True)
shutil.copy2(config,backup/'nginx.conf')
original=config.read_text()
if 'listen 443 ssl' not in original:
    assert '    listen 80;' in original
    updated=original.replace('    listen 80;', '''    listen 80;
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/kountryeye-production-ip/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kountryeye-production-ip/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:KountryTLS:10m;
    ssl_session_timeout 1d;''',1)
    config.write_text(updated)
try:
    subprocess.run(['nginx','-t'],check=True)
    subprocess.run(['systemctl','reload','nginx'],check=True)
except Exception:
    config.write_text(original)
    raise
print('Nginx backup:',backup)
PY
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/kountryeye-nginx <<'HOOK'
#!/bin/sh
set -e
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/kountryeye-nginx
cat > /etc/systemd/system/kountryeye-certbot-renew.service <<'SERVICE'
[Unit]
Description=Renew Kountry Eyecare production IP certificate
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/kountryeye-certbot/bin/certbot renew --quiet
SERVICE
cat > /etc/systemd/system/kountryeye-certbot-renew.timer <<'TIMER'
[Unit]
Description=Check Kountry Eyecare certificate renewal twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true
[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
systemctl enable --now kountryeye-certbot-renew.timer
curl --fail --silent --show-error "https://$production_ip/" -o /dev/null
systemctl is-active nginx kountryeye-certbot-renew.timer
