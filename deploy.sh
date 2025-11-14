#!/bin/bash

# Be My Eyes Helper - Production Deployment Script
# Run this script on your server as root

set -e  # Exit on error

echo "=================================================="
echo "  Be My Eyes Helper - Production Deployment"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/bme-helper"
DOMAIN="${DOMAIN:-150.107.201.220}"
PORT="${PORT:-3000}"
REPO_URL="${REPO_URL:-https://github.com/Yuanyiis/element-call.git}"
BRANCH="${BRANCH:-claude/review-project-docs-01MccRDcsfwy7FzpBSBzeBQ2}"

echo -e "${GREEN}Configuration:${NC}"
echo "  App Directory: $APP_DIR"
echo "  Domain/IP: $DOMAIN"
echo "  Port: $PORT"
echo "  Repository: $REPO_URL"
echo "  Branch: $BRANCH"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}Error: Please run as root${NC}"
   exit 1
fi

echo -e "${YELLOW}[1/8] Checking system requirements...${NC}"

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "  OS: $NAME $VERSION"
else
    echo -e "${RED}Error: Cannot detect OS${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}[2/8] Installing system dependencies...${NC}"

# Update package lists
apt-get update -qq

# Install required packages
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw

echo ""
echo -e "${YELLOW}[3/8] Installing Node.js 20...${NC}"

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "  Node.js already installed: $NODE_VERSION"
else
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "  Node.js installed: $(node -v)"
fi

# Enable corepack for Yarn
corepack enable

echo ""
echo -e "${YELLOW}[4/8] Cloning repository...${NC}"

# Create app directory
mkdir -p $APP_DIR
cd /tmp

# Clone repository
if [ -d "/tmp/element-call" ]; then
    rm -rf /tmp/element-call
fi

echo "  Cloning from $REPO_URL (branch: $BRANCH)..."
git clone --branch $BRANCH --depth 1 $REPO_URL /tmp/element-call

# Copy to app directory
echo "  Copying files to $APP_DIR..."
rsync -av --delete /tmp/element-call/ $APP_DIR/

cd $APP_DIR

echo ""
echo -e "${YELLOW}[5/8] Installing dependencies...${NC}"

# Install dependencies
yarn install --production=false

echo ""
echo -e "${YELLOW}[6/8] Building application...${NC}"

# Create production config
cat > public/config.json << EOF
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://matrix.org",
      "server_name": "matrix.org"
    }
  }
}
EOF

# Build application
NODE_OPTIONS=--max-old-space-size=4096 yarn build:full:production

echo ""
echo -e "${YELLOW}[7/8] Configuring Nginx...${NC}"

# Create Nginx configuration
cat > /etc/nginx/sites-available/bme-helper << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root $APP_DIR/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /config.json {
        add_header Cache-Control "no-cache";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/bme-helper /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx

echo ""
echo -e "${YELLOW}[8/8] Configuring firewall...${NC}"

# Configure UFW
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

echo ""
echo -e "${GREEN}=================================================="
echo "  Deployment Complete! 🎉"
echo "==================================================${NC}"
echo ""
echo -e "${GREEN}Access your application at:${NC}"
echo "  http://$DOMAIN"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Visit http://$DOMAIN to test the application"
echo "  2. Configure Matrix homeserver (optional)"
echo "  3. Setup SSL certificate (optional):"
echo "     certbot --nginx -d $DOMAIN"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View Nginx logs:    tail -f /var/log/nginx/access.log"
echo "  View error logs:    tail -f /var/log/nginx/error.log"
echo "  Restart Nginx:      systemctl restart nginx"
echo "  Check Nginx status: systemctl status nginx"
echo ""
echo -e "${YELLOW}Application Details:${NC}"
echo "  Install directory:  $APP_DIR"
echo "  Config file:        $APP_DIR/public/config.json"
echo "  Build files:        $APP_DIR/dist"
echo ""
echo -e "${GREEN}Deployment script completed successfully!${NC}"
