#!/bin/bash
set -e

# Be My Eyes Helper - Production Deployment Script
# Port: 8811
# Date: 2025-11-14

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/bme-helper"
PORT=8811
REPO_URL="https://github.com/Yuanyiis/element-call.git"
BRANCH="claude/review-project-docs-01MccRDcsfwy7FzpBSBzeBQ2"
SERVER_IP="150.107.201.220"

echo "=================================================="
echo "  Be My Eyes Helper - Production Deployment"
echo "  Port: $PORT"
echo "=================================================="
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_status "Starting deployment process..."

# Step 1: Fix APT sources
echo ""
echo "[1/10] Fixing APT sources..."
if grep -q "bullseye-backports" /etc/apt/sources.list 2>/dev/null || grep -q "bullseye-backports" /etc/apt/sources.list.d/*.list 2>/dev/null; then
    print_warning "Removing problematic backports repository..."
    sed -i '/bullseye-backports/d' /etc/apt/sources.list 2>/dev/null || true
    find /etc/apt/sources.list.d/ -type f -exec sed -i '/bullseye-backports/d' {} \; 2>/dev/null || true
fi

# Clean APT cache
rm -rf /var/lib/apt/lists/*
mkdir -p /var/lib/apt/lists/partial

print_status "APT sources cleaned"

# Step 2: Update system
echo ""
echo "[2/10] Updating package lists..."
apt-get update || {
    print_error "Failed to update package lists"
    exit 1
}
print_status "Package lists updated"

# Step 3: Install basic dependencies
echo ""
echo "[3/10] Installing basic dependencies..."
apt-get install -y curl wget git build-essential || {
    print_error "Failed to install basic dependencies"
    exit 1
}
print_status "Basic dependencies installed"

# Step 4: Install Node.js 20
echo ""
echo "[4/10] Installing Node.js 20..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | sed 's/v//')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_status "Node.js $(node -v) installed"
else
    print_status "Node.js $(node -v) already installed"
fi

# Step 5: Install Nginx
echo ""
echo "[5/10] Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    print_status "Nginx installed"
else
    print_status "Nginx already installed"
fi

# Step 6: Clone/Update repository
echo ""
echo "[6/10] Setting up application code..."
if [ -d "$APP_DIR" ]; then
    print_warning "Directory exists, updating..."
    cd "$APP_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    print_status "Cloning repository..."
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
print_status "Code ready at $APP_DIR"

# Step 7: Install dependencies and build
echo ""
echo "[7/10] Installing dependencies (this may take a few minutes)..."
npm install --production=false || {
    print_error "Failed to install dependencies"
    exit 1
}
print_status "Dependencies installed"

echo ""
echo "Building production bundle..."
npm run build || {
    print_error "Build failed"
    exit 1
}
print_status "Production build complete"

# Step 8: Install PM2
echo ""
echo "[8/10] Installing PM2 process manager..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    print_status "PM2 installed"
else
    print_status "PM2 already installed"
fi

# Step 9: Configure and start service
echo ""
echo "[9/10] Configuring service..."

# Create PM2 ecosystem config
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'bme-helper',
    script: 'npx',
    args: 'vite preview --host 0.0.0.0 --port $PORT',
    cwd: '$APP_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    }
  }]
};
EOF

# Stop existing process if running
pm2 delete bme-helper 2>/dev/null || true

# Start with PM2
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

print_status "Service started on port $PORT"

# Step 10: Configure Nginx
echo ""
echo "[10/10] Configuring Nginx reverse proxy..."

cat > /etc/nginx/sites-available/bme-helper << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/bme-helper /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t || {
    print_error "Nginx configuration test failed"
    exit 1
}

# Reload Nginx
systemctl reload nginx
print_status "Nginx configured and reloaded"

# Configure firewall if UFW is installed
if command -v ufw &> /dev/null; then
    echo ""
    print_status "Configuring firewall..."
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow $PORT/tcp
    print_status "Firewall rules added"
fi

# Final status check
echo ""
echo "=================================================="
echo "  Deployment Complete!"
echo "=================================================="
echo ""

# Wait a moment for service to start
sleep 3

# Check if service is running
if pm2 list | grep -q "bme-helper.*online"; then
    print_status "Service is running"
else
    print_error "Service may not be running properly"
    echo ""
    echo "Check logs with: pm2 logs bme-helper"
fi

# Check if port is listening
if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
    print_status "Port $PORT is listening"
else
    print_warning "Port $PORT may not be listening yet"
fi

echo ""
echo "Access your application at:"
echo "  → http://$SERVER_IP"
echo ""
echo "Service management commands:"
echo "  → View logs:    pm2 logs bme-helper"
echo "  → Restart:      pm2 restart bme-helper"
echo "  → Stop:         pm2 stop bme-helper"
echo "  → Status:       pm2 status"
echo ""
echo "Nginx management:"
echo "  → Status:       systemctl status nginx"
echo "  → Restart:      systemctl restart nginx"
echo "  → Logs:         tail -f /var/log/nginx/error.log"
echo ""
print_status "Deployment successful! 🎉"
