#!/bin/bash
set -e

# Synapse Guest Access Fix Script
# Fixes "Guest access not allowed" errors

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================================="
echo "  Synapse Guest Access Configuration Fix"
echo "=================================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root"
    exit 1
fi

# Check if Synapse is installed
if [ ! -f /opt/synapse/data/homeserver.yaml ]; then
    echo "Synapse not found at /opt/synapse/data/homeserver.yaml"
    exit 1
fi

echo "[1/4] Backing up current configuration..."
cp /opt/synapse/data/homeserver.yaml /opt/synapse/data/homeserver.yaml.backup
echo -e "${GREEN}✓${NC} Backup created"

echo ""
echo "[2/4] Updating homeserver configuration..."

# Remove old guest/registration config if exists
sed -i '/^enable_registration:/d' /opt/synapse/data/homeserver.yaml
sed -i '/^enable_registration_without_verification:/d' /opt/synapse/data/homeserver.yaml
sed -i '/^allow_guest_access:/d' /opt/synapse/data/homeserver.yaml
sed -i '/^enable_guest_access:/d' /opt/synapse/data/homeserver.yaml

# Add comprehensive guest access configuration at the end
cat >> /opt/synapse/data/homeserver.yaml << 'EOF'

# ============================================
# BME Helper Guest Access Configuration
# ============================================

# Enable open registration
enable_registration: true
enable_registration_without_verification: true
enable_registration_captcha: false
registration_requires_token: false

# Guest access
allow_guest_access: true

# Disable rate limiting for better user experience
rc_registration:
  per_second: 100
  burst_count: 300

rc_login:
  address:
    per_second: 100
    burst_count: 300
  account:
    per_second: 100
    burst_count: 300
  failed_attempts:
    per_second: 100
    burst_count: 300

# Disable presence to reduce server load
use_presence: false
presence:
  enabled: false

# Disable typing notifications to reduce load
enable_typing: false

# Reduce sync requirements
filter_timeline_limit: 100

# Allow public rooms
allow_public_rooms_over_federation: true
allow_public_rooms_without_auth: true

# Reduce encryption overhead for testing
encryption_enabled_by_default_for_room_type: off

# Media configuration
max_upload_size: 50M
max_image_pixels: 32M

# Auto-join new users to no rooms (empty list)
auto_join_rooms: []

# Retention
retention:
  enabled: true
  default_policy:
    min_lifetime: 1d
    max_lifetime: 7d
EOF

echo -e "${GREEN}✓${NC} Configuration updated"

echo ""
echo "[3/4] Restarting Synapse..."
cd /opt/synapse
docker-compose restart synapse

# Wait for Synapse to start
echo "Waiting for Synapse to start..."
sleep 15

echo -e "${GREEN}✓${NC} Synapse restarted"

echo ""
echo "[4/4] Verifying configuration..."

# Test if Synapse is responding
if curl -s http://localhost:8008/_matrix/client/versions > /dev/null; then
    echo -e "${GREEN}✓${NC} Synapse is responding"
else
    echo -e "${YELLOW}⚠${NC} Synapse may still be starting..."
fi

# Test registration
echo ""
echo "Testing registration..."
RANDOM_USER="test_$(date +%s)"
RESPONSE=$(curl -s -X POST http://localhost:8008/_matrix/client/v3/register \
  -H "Content-Type: application/json" \
  -d "{\"auth\":{\"type\":\"m.login.dummy\"},\"username\":\"$RANDOM_USER\",\"password\":\"test123\"}")

if echo "$RESPONSE" | grep -q "user_id"; then
    echo -e "${GREEN}✓${NC} Registration test successful!"
    echo "Sample response: $(echo $RESPONSE | jq -r '.user_id' 2>/dev/null || echo $RESPONSE | head -c 80)"
else
    echo -e "${YELLOW}⚠${NC} Registration test result:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
fi

echo ""
echo "=================================================="
echo "  Configuration Update Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "  1. Update Element Call: cd /opt/bme-helper && git pull && npm run build"
echo "  2. Reload Nginx: systemctl reload nginx"
echo "  3. Clear browser cache and test: https://call.fst.gs"
echo ""
echo "If issues persist, check logs:"
echo "  docker-compose -f /opt/synapse/docker-compose.yml logs synapse | tail -50"
echo ""
