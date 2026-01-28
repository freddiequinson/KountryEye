#!/bin/bash

# Kountry Eyecare Deployment Script for DigitalOcean Droplet
# Run this script on your droplet after initial setup

set -e  # Exit on any error

echo "=========================================="
echo "Kountry Eyecare Deployment Script"
echo "=========================================="

# Variables - Update these
APP_DIR="/var/www/kountryeye"
REPO_URL="https://github.com/YOUR_USERNAME/KountryEye.git"  # Update with your repo URL

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "Installing required packages..."
sudo apt install -y python3 python3-pip python3-venv nginx git nodejs npm

# Install Node.js 20 LTS (for building frontend)
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Create app directory
echo "Creating application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Clone or pull repository
if [ -d "$APP_DIR/.git" ]; then
    echo "Pulling latest changes..."
    cd $APP_DIR
    git pull origin main
else
    echo "Cloning repository..."
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Setup Backend
echo "Setting up backend..."
cd $APP_DIR/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn  # Production WSGI server

# Copy production environment file
if [ ! -f .env ]; then
    cp ../deployment/.env.production .env
    echo "⚠️  IMPORTANT: Edit /var/www/kountryeye/backend/.env and set your SECRET_KEY!"
fi

# Run migrations
echo "Running database migrations..."
for migration in migrations/*.py; do
    python "$migration" || true
done

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

deactivate

# Setup Frontend
echo "Building frontend..."
cd $APP_DIR/frontend

# Install dependencies and build
npm install
npm run build

# Copy built files to nginx directory
sudo mkdir -p /var/www/kountryeye/frontend
sudo cp -r dist/* /var/www/kountryeye/frontend/

# Setup Nginx
echo "Configuring Nginx..."
sudo cp $APP_DIR/deployment/nginx.conf /etc/nginx/sites-available/kountryeye
sudo ln -sf /etc/nginx/sites-available/kountryeye /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Setup systemd service
echo "Setting up systemd service..."
sudo cp $APP_DIR/deployment/kountryeye.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kountryeye
sudo systemctl start kountryeye

# Restart nginx
sudo systemctl restart nginx

# Set proper permissions
sudo chown -R www-data:www-data $APP_DIR/backend/uploads
sudo chown -R www-data:www-data $APP_DIR/backend/kountry_eyecare.db 2>/dev/null || true

echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit /var/www/kountryeye/backend/.env and set a secure SECRET_KEY"
echo "   Run: openssl rand -hex 32"
echo "2. Edit /etc/nginx/sites-available/kountryeye and set your domain/IP"
echo "3. Restart services: sudo systemctl restart kountryeye nginx"
echo "4. Check status: sudo systemctl status kountryeye"
echo ""
echo "Your app should be accessible at http://YOUR_DROPLET_IP"
