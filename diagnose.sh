#!/bin/bash

# BME Helper Diagnostic Script
# Collects logs and debugging information

echo "=============================================="
echo "  BME Helper Diagnostic Information"
echo "  $(date)"
echo "=============================================="
echo ""

echo "=== 1. Synapse Status ==="
docker ps --filter "name=synapse" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "=== 2. Synapse Logs (Last 50 lines) ==="
docker logs synapse-synapse-1 --tail 50 2>&1 | grep -E "ERROR|WARN|volunteer|pool|guest|register" || docker logs synapse-synapse-1 --tail 50 2>&1
echo ""

echo "=== 3. Nginx Status ==="
systemctl status nginx --no-pager | head -20
echo ""

echo "=== 4. Nginx Error Log (Last 30 lines) ==="
tail -30 /var/log/nginx/error.log 2>/dev/null || echo "No nginx error log"
echo ""

echo "=== 5. Nginx Access Log (Last 10 requests) ==="
tail -10 /var/log/nginx/access.log 2>/dev/null || echo "No nginx access log"
echo ""

echo "=== 6. Test Synapse Registration ==="
TEST_USER="diagtest_$(date +%s)"
RESPONSE=$(curl -s -X POST http://localhost:8008/_matrix/client/v3/register \
  -H "Content-Type: application/json" \
  -d "{\"auth\":{\"type\":\"m.login.dummy\"},\"username\":\"$TEST_USER\",\"password\":\"test123\"}")

if echo "$RESPONSE" | grep -q "user_id"; then
    echo "✓ Registration test PASSED"
    echo "User created: $(echo $RESPONSE | grep -o '@[^"]*')"
else
    echo "✗ Registration test FAILED"
    echo "Response: $RESPONSE"
fi
echo ""

echo "=== 7. Test Volunteer Pool Room ==="
# Try to get room alias
POOL_ALIAS="#bme-volunteer-pool:call.fst.gs"
POOL_CHECK=$(curl -s "http://localhost:8008/_matrix/client/v3/directory/room/%23bme-volunteer-pool%3Acall.fst.gs")

if echo "$POOL_CHECK" | grep -q "room_id"; then
    echo "✓ Volunteer pool room EXISTS"
    echo "Room ID: $(echo $POOL_CHECK | grep -o '![^"]*')"
else
    echo "✗ Volunteer pool room does NOT exist (will be created on first use)"
    echo "Response: $POOL_CHECK"
fi
echo ""

echo "=== 8. Check Synapse Configuration ==="
echo "Guest access settings:"
docker exec synapse-synapse-1 cat /data/homeserver.yaml | grep -A3 "enable_registration\|allow_guest" || echo "Cannot read config"
echo ""

echo "=== 9. Network Connectivity ==="
echo "Port 8008 (Synapse):"
netstat -tuln | grep 8008 || ss -tuln | grep 8008 || echo "Port 8008 not listening"
echo ""
echo "Port 80 (Nginx):"
netstat -tuln | grep :80 || ss -tuln | grep :80 || echo "Port 80 not listening"
echo ""

echo "=== 10. Recent Element Call Build ==="
if [ -d "/opt/bme-helper/dist" ]; then
    echo "Build directory exists"
    echo "Build time: $(stat -c %y /opt/bme-helper/dist 2>/dev/null || stat -f %Sm /opt/bme-helper/dist 2>/dev/null)"
    echo "Size: $(du -sh /opt/bme-helper/dist 2>/dev/null | cut -f1)"
    echo ""
    echo "Config file:"
    if [ -f "/opt/bme-helper/dist/config.json" ]; then
        cat /opt/bme-helper/dist/config.json
    elif [ -f "/opt/bme-helper/public/config.json" ]; then
        cat /opt/bme-helper/public/config.json
    else
        echo "No config.json found"
    fi
else
    echo "Build directory does not exist!"
fi
echo ""

echo "=== 11. Git Status ==="
cd /opt/bme-helper 2>/dev/null && {
    echo "Current branch: $(git branch --show-current)"
    echo "Latest commit: $(git log -1 --oneline)"
    echo "Status: $(git status --short | wc -l) uncommitted changes"
} || echo "Not a git repository"
echo ""

echo "=============================================="
echo "  Diagnostic Complete"
echo "=============================================="
echo ""
echo "If you see errors above, please share this output for debugging."
