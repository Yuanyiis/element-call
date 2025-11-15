#!/bin/bash

# Fix Element Call configuration to use correct homeserver

echo "Fixing Element Call configuration..."

# Update public/config.json
cat > /opt/bme-helper/public/config.json << 'EOF'
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "http://150.107.201.220:8008",
      "server_name": "call.fst.gs"
    }
  }
}
EOF

echo "✓ Updated public/config.json"

# Update dist/config.json (if exists)
if [ -d "/opt/bme-helper/dist" ]; then
    cat > /opt/bme-helper/dist/config.json << 'EOF'
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "http://150.107.201.220:8008",
      "server_name": "call.fst.gs"
    }
  }
}
EOF
    echo "✓ Updated dist/config.json"
fi

echo ""
echo "Configuration fixed!"
echo "Element Call will now use the Synapse server at http://150.107.201.220:8008"
echo ""
echo "Now restart nginx:"
echo "  systemctl reload nginx"
echo ""
echo "Then refresh your browser and test again!"
