#!/bin/bash

# Quick Deploy Script - Run this on your droplet after uploading files
# Usage: bash quick-deploy.sh

set -e

echo "🚀 Starting Kountry Eyecare Quick Deploy..."

APP_DIR="/var/www/kountryeye"

# Install dependencies
echo "📦 Installing system packages..."
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nginx

# Install Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "✅ Node.js $(node -v) installed"
echo "✅ Python $(python3 --version) installed"

# Setup Backend
echo "🔧 Setting up backend..."
cd $APP_DIR/backend

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Create .env if not exists
if [ ! -f .env ]; then
    SECRET=$(openssl rand -hex 32)
    cat > .env << EOF
PROJECT_NAME=Kountry Eyecare
SECRET_KEY=$SECRET
DATABASE_URL=sqlite+aiosqlite:///./kountry_eyecare.db
EOF
    echo "✅ Created .env with secure secret key"
fi

# Run migrations
echo "🗄️ Running database migrations..."
for f in migrations/*.py; do 
    python "$f" 2>/dev/null || true
done

mkdir -p uploads
deactivate

# Build Frontend
echo "🏗️ Building frontend..."
cd $APP_DIR/frontend
npm install
npm run build

sudo mkdir -p /var/www/kountryeye/frontend-dist
sudo cp -r dist/* /var/www/kountryeye/frontend-dist/

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/kountryeye > /dev/null << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    location / {
        root /var/www/kountryeye/frontend-dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    location /uploads {
        alias /var/www/kountryeye/backend/uploads;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/kountryeye /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup systemd service
echo "⚙️ Setting up backend service..."
sudo tee /etc/systemd/system/kountryeye.service > /dev/null << EOF
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
EOF

# Set permissions
sudo chown -R www-data:www-data $APP_DIR/backend/uploads
sudo chown www-data:www-data $APP_DIR/backend/kountry_eyecare.db 2>/dev/null || true
sudo chown www-data:www-data $APP_DIR/backend/.env

# Start service
sudo systemctl daemon-reload
sudo systemctl enable kountryeye
sudo systemctl restart kountryeye

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🌐 Your app is now live at: http://$SERVER_IP"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    sudo journalctl -u kountryeye -f"
echo "   Restart:      sudo systemctl restart kountryeye"
echo "   Status:       sudo systemctl status kountryeye"
echo ""
