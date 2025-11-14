#!/bin/bash
set -e

# Be My Eyes Helper - Production Deployment Script (Fixed)
# Port: 8811 (direct access, no nginx proxy)
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
echo "  Port: $PORT (Direct Access)"
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
echo "[1/8] Fixing APT sources..."
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
echo "[2/8] Updating package lists..."
apt-get update || {
    print_error "Failed to update package lists"
    exit 1
}
print_status "Package lists updated"

# Step 3: Install basic dependencies
echo ""
echo "[3/8] Installing basic dependencies..."
apt-get install -y curl wget git build-essential || {
    print_error "Failed to install basic dependencies"
    exit 1
}
print_status "Basic dependencies installed"

# Step 4: Install Node.js 20
echo ""
echo "[4/8] Installing Node.js 20..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | sed 's/v//')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_status "Node.js $(node -v) installed"
else
    print_status "Node.js $(node -v) already installed"
fi

# Step 5: Clone/Update repository
echo ""
echo "[5/8] Setting up application code..."
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

# Step 6: Install dependencies and build
echo ""
echo "[6/8] Installing dependencies with legacy peer deps (this may take a few minutes)..."
cd "$APP_DIR"
npm install --legacy-peer-deps || {
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

# Step 7: Install PM2
echo ""
echo "[7/8] Installing PM2 process manager..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    print_status "PM2 installed"
else
    print_status "PM2 already installed"
fi

# Step 8: Configure and start service
echo ""
echo "[8/8] Configuring and starting service..."

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
    },
    error_file: '/var/log/bme-helper-error.log',
    out_file: '/var/log/bme-helper-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Stop existing process if running
pm2 delete bme-helper 2>/dev/null || true

# Start with PM2
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root || true

print_status "Service started on port $PORT"

# Configure firewall if UFW is installed
if command -v ufw &> /dev/null; then
    echo ""
    print_status "Configuring firewall..."
    ufw allow $PORT/tcp
    print_status "Firewall rule added for port $PORT"
fi

# Final status check
echo ""
echo "=================================================="
echo "  Deployment Complete!"
echo "=================================================="
echo ""

# Wait a moment for service to start
sleep 5

# Check if service is running
if pm2 list | grep -q "bme-helper.*online"; then
    print_status "Service is RUNNING"

    # Get more details
    echo ""
    pm2 info bme-helper | grep -E "status|uptime|cpu|memory"
else
    print_error "Service may not be running properly"
    echo ""
    echo "Showing recent logs:"
    pm2 logs bme-helper --lines 20 --nostream
fi

# Check if port is listening
echo ""
if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
    print_status "Port $PORT is LISTENING"
else
    print_warning "Port $PORT may not be listening yet"
    echo "Waiting 3 more seconds..."
    sleep 3
    if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
        print_status "Port $PORT is now LISTENING"
    else
        print_error "Port $PORT is still not listening"
        echo ""
        echo "Check logs with: pm2 logs bme-helper"
    fi
fi

# Test HTTP connection
echo ""
echo "Testing HTTP connection..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT | grep -q "200\|301\|302"; then
    print_status "HTTP server is responding"
else
    print_warning "HTTP server may not be responding yet"
fi

echo ""
echo "=================================================="
echo "Access your application at:"
echo "  → http://$SERVER_IP:$PORT"
echo ""
echo "Service management commands:"
echo "  → View logs:        pm2 logs bme-helper"
echo "  → View live logs:   pm2 logs bme-helper --lines 100"
echo "  → Restart:          pm2 restart bme-helper"
echo "  → Stop:             pm2 stop bme-helper"
echo "  → Status:           pm2 status"
echo "  → Detailed info:    pm2 info bme-helper"
echo ""
echo "Log files location:"
echo "  → Error log:  /var/log/bme-helper-error.log"
echo "  → Output log: /var/log/bme-helper-out.log"
echo ""
print_status "Deployment successful! 🎉"
echo ""
echo "Note: Since port 80 is occupied, access directly via port $PORT"
