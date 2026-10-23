# KountryEye Production Deployment Guide

This document outlines the production deployment process for KountryEye.

---

## Server Details

- **Production Server:** `$SERVER_IP`
- **SSH Access:** `ssh root@$SERVER_IP`
- **Application Path:** `/var/www/kountryeye/`

---

## Directory Structure

```
/var/www/kountryeye/
├── backend/              # FastAPI backend
│   ├── app/              # Application code
│   ├── venv/             # Python virtual environment
│   ├── kountry_eyecare.db  # SQLite database
│   └── uploads/          # Uploaded files
├── frontend-dist/        # Built frontend (NGINX serves from here)
│   ├── index.html
│   └── assets/           # JS/CSS bundles
└── frontend/             # (Not used by nginx - legacy)
```

---

## NGINX Configuration

- **Config file:** `/etc/nginx/sites-enabled/kountryeye`
- **Frontend root:** `/var/www/kountryeye/frontend-dist`
- **Backend proxy:** `http://127.0.0.1:8000`

```nginx
server {
    listen 80;
    server_name $SERVER_IP;

    location / {
        root /var/www/kountryeye/frontend-dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        # ... proxy headers
    }

    location /uploads {
        alias /var/www/kountryeye/backend/uploads;
    }
}
```

**Reload nginx:** `nginx -s reload`

---

## Backend Service

- **Service name:** `kountryeye`
- **Service file:** `/etc/systemd/system/kountryeye.service`

**Commands:**
```bash
systemctl status kountryeye    # Check status
systemctl restart kountryeye   # Restart backend
systemctl stop kountryeye      # Stop backend
journalctl -u kountryeye -n 50 # View logs
```

---

## Deployment Steps

### 1. Build Frontend Locally

```bash
cd frontend
npm run build
```

This creates `frontend/dist/` with the production build.

### 2. Push Code to GitHub

```bash
git add -A
git commit -m "Your commit message"
git push origin HEAD:main
```

### 3. Pull Changes on Production Server

```bash
ssh root@$SERVER_IP "cd /var/www/kountryeye && git pull origin main"
```

### 4. Deploy Frontend Build

**Copy built files to production:**
```bash
scp -r frontend/dist/* root@$SERVER_IP:/var/www/kountryeye/frontend-dist/
scp -r frontend/dist/assets/* root@$SERVER_IP:/var/www/kountryeye/frontend-dist/assets/
```

**Fix permissions (important!):**
```bash
ssh root@$SERVER_IP "chmod 755 /var/www/kountryeye/frontend-dist/assets && chmod 644 /var/www/kountryeye/frontend-dist/assets/*"
```

### 5. Restart Backend

```bash
ssh root@$SERVER_IP "systemctl restart kountryeye"
```

### 6. Reload NGINX (if needed)

```bash
ssh root@$SERVER_IP "nginx -s reload"
```

---

## Database Operations

### Run Migrations (Add Column)

SQLite doesn't support full migrations. Use direct SQL:

```bash
ssh root@$SERVER_IP "sqlite3 /var/www/kountryeye/backend/kountry_eyecare.db 'ALTER TABLE users ADD COLUMN new_column BOOLEAN DEFAULT 0;'"
```

### Query Database

```bash
ssh root@$SERVER_IP "sqlite3 /var/www/kountryeye/backend/kountry_eyecare.db 'SELECT id, email FROM users;'"
```

### Backup Database

```bash
ssh root@$SERVER_IP "cp /var/www/kountryeye/backend/kountry_eyecare.db /var/www/kountryeye/backend/kountry_eyecare_backup_$(date +%Y%m%d).db"
```

---

## Quick Deploy Script

Run this from local machine after building frontend:

```bash
# Build
cd frontend && npm run build && cd ..

# Commit and push
git add -A && git commit -m "Deploy update" && git push origin HEAD:main

# Deploy to server
ssh root@$SERVER_IP "cd /var/www/kountryeye && git pull origin main"
scp -r frontend/dist/* root@$SERVER_IP:/var/www/kountryeye/frontend-dist/
scp -r frontend/dist/assets/* root@$SERVER_IP:/var/www/kountryeye/frontend-dist/assets/
ssh root@$SERVER_IP "chmod 755 /var/www/kountryeye/frontend-dist/assets && systemctl restart kountryeye"
```

---

## Troubleshooting

### MIME Type Error (JS not loading)
**Cause:** Assets folder has wrong permissions
**Fix:** `chmod 755 /var/www/kountryeye/frontend-dist/assets`

### Old JS Files Cached
**Fix:** Clear old files before deploying:
```bash
ssh root@$SERVER_IP "rm -f /var/www/kountryeye/frontend-dist/assets/index-*.js /var/www/kountryeye/frontend-dist/assets/index-*.css"
```

### Backend Not Starting
**Check logs:** `journalctl -u kountryeye -n 100`

### API Returns 502
**Cause:** Backend not running
**Fix:** `systemctl restart kountryeye`

---

## Important Notes

1. **Always copy to `frontend-dist/`** - NOT `frontend/`
2. **Always fix permissions** after copying assets
3. **Restart backend** after Python code changes
4. **Reload nginx** only if nginx config changes
5. **Clear browser cache** (Ctrl+F5) after frontend deploys
