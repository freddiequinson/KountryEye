# Kountry Eyecare - DigitalOcean Deployment Guide

This guide walks you through deploying Kountry Eyecare on a DigitalOcean Droplet.

## Cost Estimate
- **$6/month** - Basic Droplet (1 GB RAM, 1 vCPU, 25 GB SSD)
- This is sufficient for a small to medium clinic with ~50-100 daily users

---

## Step 1: Create a DigitalOcean Account

1. Go to [digitalocean.com](https://www.digitalocean.com)
2. Sign up (you may get $200 free credit for 60 days as a new user)
3. Add a payment method

---

## Step 2: Create a Droplet

1. Click **"Create"** → **"Droplets"**
2. Choose settings:
   - **Region**: Choose closest to your users (e.g., London for Ghana)
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic → Regular → **$6/mo** (1 GB RAM, 1 vCPU)
   - **Authentication**: Choose **SSH Key** (recommended) or **Password**
   
   ### If using SSH Key (Recommended):
   - On your Windows PC, open PowerShell and run:
     ```powershell
     ssh-keygen -t ed25519 -C "your-email@example.com"
     ```
   - Press Enter for default location, set a passphrase (optional)
   - Copy the public key:
     ```powershell
     cat ~/.ssh/id_ed25519.pub
     ```
   - Paste this into DigitalOcean's "New SSH Key" field

3. **Hostname**: `kountryeye-server`
4. Click **"Create Droplet"**
5. Note your **Droplet IP address** (e.g., `164.92.xxx.xxx`)

---

## Step 3: Connect to Your Droplet

Open PowerShell or Terminal and run:

```bash
ssh root@YOUR_DROPLET_IP
```

If using password, enter it when prompted.

---

## Step 4: Initial Server Setup

Run these commands on your droplet:

```bash
# Update system
apt update && apt upgrade -y

# Create a non-root user (recommended for security)
adduser kountry
usermod -aG sudo kountry

# Allow the new user to use SSH
rsync --archive --chown=kountry:kountry ~/.ssh /home/kountry

# Setup firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Exit and reconnect as the new user
exit
```

Reconnect as the new user:
```bash
ssh kountry@YOUR_DROPLET_IP
```

---

## Step 5: Upload Your Project

### Option A: Using Git (Recommended)

1. Push your project to GitHub:
   ```powershell
   # On your Windows PC, in the KountryEye folder
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/KountryEye.git
   git push -u origin main
   ```

2. On your droplet, clone the repo:
   ```bash
   sudo mkdir -p /var/www/kountryeye
   sudo chown -R $USER:$USER /var/www/kountryeye
   git clone https://github.com/freddiequinson/KountryEye.git /var/www/kountryeye
   ```

### Option B: Using SCP (Direct Upload)

On your Windows PC (PowerShell):
```powershell
# Compress the project (excluding node_modules and venv)
cd C:\Users\USER
tar --exclude='node_modules' --exclude='venv' --exclude='.git' --exclude='dist' -czvf kountryeye.tar.gz KountryEye

# Upload to droplet
scp kountryeye.tar.gz kountry@YOUR_DROPLET_IP:/tmp/

# On the droplet, extract it
ssh kountry@YOUR_DROPLET_IP
sudo mkdir -p /var/www/kountryeye
sudo tar -xzvf /tmp/kountryeye.tar.gz -C /var/www/
sudo mv /var/www/KountryEye/* /var/www/kountryeye/
sudo chown -R $USER:$USER /var/www/kountryeye
```

---

## Step 6: Install Dependencies

On your droplet:

```bash
# Install system packages
sudo apt install -y python3 python3-pip python3-venv nginx git

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
python3 --version
node --version
npm --version
```

---

## Step 7: Setup Backend

```bash
cd /var/www/kountryeye/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Generate a secure secret key
openssl rand -hex 32
# Copy the output!

# Create production .env file
nano .env
```

Paste this into the .env file (press Ctrl+X, Y, Enter to save):
```
PROJECT_NAME=Kountry Eyecare
SECRET_KEY=PASTE_YOUR_GENERATED_KEY_HERE
DATABASE_URL=sqlite+aiosqlite:///./kountry_eyecare.db
```

Run migrations:
```bash
# Run all migration scripts
for f in migrations/*.py; do python "$f"; done

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

deactivate
```

---

## Step 8: Build Frontend

```bash
cd /var/www/kountryeye/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Copy built files
sudo mkdir -p /var/www/kountryeye/frontend-dist
sudo cp -r dist/* /var/www/kountryeye/frontend-dist/
```

---

## Step 9: Configure Nginx

```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/kountryeye
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_DROPLET_IP;  # Replace with your IP or domain

    # Frontend
    location / {
        root /var/www/kountryeye/frontend-dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Uploads
    location /uploads {
        alias /var/www/kountryeye/backend/uploads;
    }
}
```

Enable the site:
```bash
sudo ln -sf /etc/nginx/sites-available/kountryeye /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 10: Create Systemd Service

```bash
sudo nano /etc/systemd/system/kountryeye.service
```

Paste:
```ini
[Unit]
Description=Kountry Eyecare Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/kountryeye/backend
Environment="PATH=/var/www/kountryeye/backend/venv/bin"
ExecStart=/var/www/kountryeye/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Set permissions and start:
```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/kountryeye/backend/uploads
sudo chown www-data:www-data /var/www/kountryeye/backend/kountry_eyecare.db

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable kountryeye
sudo systemctl start kountryeye

# Check status
sudo systemctl status kountryeye
```

---

## Step 11: Test Your Deployment

Open your browser and go to:
```
http://YOUR_DROPLET_IP
```

You should see the Kountry Eyecare login page!

---

## Step 12: (Optional) Add a Domain & SSL

### Add a Domain
1. Buy a domain (e.g., from Namecheap, GoDaddy)
2. In your domain's DNS settings, add an **A Record**:
   - Host: `@`
   - Value: `YOUR_DROPLET_IP`
3. Wait 5-30 minutes for DNS propagation

### Add Free SSL with Let's Encrypt
```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
```

---

## Useful Commands

```bash
# View backend logs
sudo journalctl -u kountryeye -f

# Restart backend
sudo systemctl restart kountryeye

# Restart nginx
sudo systemctl restart nginx

# Check backend status
sudo systemctl status kountryeye

# Update application (after pushing changes to git)
cd /var/www/kountryeye
git pull
cd backend && source venv/bin/activate && pip install -r requirements.txt && deactivate
cd ../frontend && npm install && npm run build
sudo cp -r dist/* /var/www/kountryeye/frontend-dist/
sudo systemctl restart kountryeye
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs
sudo journalctl -u kountryeye -n 50

# Test manually
cd /var/www/kountryeye/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 502 Bad Gateway
- Backend is not running. Check: `sudo systemctl status kountryeye`

### Permission denied errors
```bash
sudo chown -R www-data:www-data /var/www/kountryeye/backend/uploads
sudo chown www-data:www-data /var/www/kountryeye/backend/kountry_eyecare.db
```

### Database locked
- Only one process should access SQLite. Restart the service:
```bash
sudo systemctl restart kountryeye
```

---

## Backup Your Data

Create a backup script:
```bash
sudo nano /home/kountry/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/home/kountry/backups"
mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/kountryeye/backend/kountry_eyecare.db $BACKUP_DIR/kountry_eyecare_$DATE.db

# Backup uploads
tar -czvf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/kountryeye/backend/uploads

# Keep only last 7 days
find $BACKUP_DIR -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make it executable and schedule:
```bash
chmod +x /home/kountry/backup.sh

# Run daily at 2 AM
crontab -e
# Add this line:
0 2 * * * /home/kountry/backup.sh
```

---

## Summary

Your Kountry Eyecare app is now live at `http://YOUR_DROPLET_IP`!

**Monthly Cost**: ~$6/month for the basic droplet

**What you have**:
- ✅ FastAPI backend running as a service
- ✅ React frontend served by Nginx
- ✅ Automatic restart on crash
- ✅ File uploads working
- ✅ WebSocket support for real-time messaging

**Optional upgrades**:
- Add a domain name (~$10-15/year)
- Add SSL certificate (free with Let's Encrypt)
- Upgrade droplet if you need more resources
