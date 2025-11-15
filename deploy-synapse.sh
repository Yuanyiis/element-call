#!/bin/bash
set -e

# Synapse (Matrix Homeserver) Deployment Script
# For BME Helper Application
# This enables guest/passwordless registration

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Configuration
SERVER_NAME="call.fst.gs"
SYNAPSE_PORT=8008
POSTGRES_PASSWORD=$(openssl rand -base64 32)

echo "=================================================="
echo "  Synapse Matrix Homeserver Deployment"
echo "  Server: $SERVER_NAME"
echo "=================================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root"
    exit 1
fi

# Step 1: Install Docker
echo "[1/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    print_status "Docker installed"
else
    print_status "Docker already installed"
fi

# Step 2: Create directories
echo ""
echo "[2/6] Creating Synapse directories..."
mkdir -p /opt/synapse/data
mkdir -p /opt/synapse/postgres
print_status "Directories created"

# Step 3: Generate Synapse config
echo ""
echo "[3/6] Generating Synapse configuration..."
docker run -it --rm \
    -v /opt/synapse/data:/data \
    -e SYNAPSE_SERVER_NAME=$SERVER_NAME \
    -e SYNAPSE_REPORT_STATS=no \
    matrixdotorg/synapse:latest generate

print_status "Configuration generated"

# Step 4: Update homeserver.yaml for guest registration
echo ""
echo "[4/6] Configuring guest and passwordless registration..."

cat >> /opt/synapse/data/homeserver.yaml << 'EOF'

# Enable registration
enable_registration: true
enable_registration_without_verification: true

# Allow guest access
allow_guest_access: true

# Disable rate limiting for testing
rc_registration:
  per_second: 10
  burst_count: 30

rc_login:
  address:
    per_second: 10
    burst_count: 30
  account:
    per_second: 10
    burst_count: 30
  failed_attempts:
    per_second: 10
    burst_count: 30

# TURN server for WebRTC (optional, for better connectivity)
turn_uris: []
turn_shared_secret: ""
turn_user_lifetime: 86400000

# Disable presence to reduce load
use_presence: false

# Enable message retention
retention:
  enabled: true
  default_policy:
    min_lifetime: 1d
    max_lifetime: 1y

# Allow public rooms
allow_public_rooms_over_federation: true
allow_public_rooms_without_auth: true
EOF

print_status "Configuration updated"

# Step 5: Create docker-compose.yml
echo ""
echo "[5/6] Creating Docker Compose configuration..."

cat > /opt/synapse/docker-compose.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_USER: synapse
      POSTGRES_DB: synapse
      POSTGRES_INITDB_ARGS: --encoding=UTF-8 --lc-collate=C --lc-ctype=C
    volumes:
      - /opt/synapse/postgres:/var/lib/postgresql/data
    networks:
      - synapse_network

  synapse:
    image: matrixdotorg/synapse:latest
    restart: unless-stopped
    environment:
      SYNAPSE_CONFIG_PATH: /data/homeserver.yaml
    volumes:
      - /opt/synapse/data:/data
    ports:
      - "8008:8008"
    depends_on:
      - postgres
    networks:
      - synapse_network

networks:
  synapse_network:
    driver: bridge
EOF

print_status "Docker Compose configured"

# Step 6: Start Synapse
echo ""
echo "[6/6] Starting Synapse..."
cd /opt/synapse
docker-compose up -d

# Wait for Synapse to start
sleep 10

# Check if Synapse is running
if curl -s http://localhost:8008/_matrix/client/versions > /dev/null; then
    print_status "Synapse is running!"
else
    print_warning "Synapse may still be starting up..."
fi

# Configure firewall
if command -v ufw &> /dev/null; then
    ufw allow 8008/tcp
    print_status "Firewall configured"
fi

echo ""
echo "=================================================="
echo "  Synapse Deployment Complete!"
echo "=================================================="
echo ""
echo "Synapse is running at:"
echo "  → http://$SERVER_NAME:8008"
echo "  → http://localhost:8008 (local)"
echo ""
echo "Next steps:"
echo "  1. Update your Element Call config.json:"
echo "     {\"default_server_config\": {\"m.homeserver\": {\"base_url\": \"http://$SERVER_NAME:8008\"}}}"
echo ""
echo "  2. Restart Element Call:"
echo "     cd /opt/bme-helper && npm run build && systemctl reload nginx"
echo ""
echo "Management commands:"
echo "  → View logs:     docker-compose -f /opt/synapse/docker-compose.yml logs -f"
echo "  → Restart:       docker-compose -f /opt/synapse/docker-compose.yml restart"
echo "  → Stop:          docker-compose -f /opt/synapse/docker-compose.yml stop"
echo "  → Start:         docker-compose -f /opt/synapse/docker-compose.yml start"
echo ""
echo "Database password (save this):"
echo "  → $POSTGRES_PASSWORD"
echo ""
print_status "Setup complete! 🎉"
