#!/bin/bash

# Setup Nginx reverse proxy for Synapse to work with https://call.fst.gs

echo "Setting up Nginx reverse proxy for Synapse..."

# Add Synapse location to the existing call.fst.gs Nginx config
cat > /etc/nginx/sites-available/synapse-proxy << 'EOF'
# Synapse Matrix server proxy for call.fst.gs

location /_matrix {
    proxy_pass http://localhost:8008;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;

    # Increase timeouts for long-polling
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Client body size
    client_max_body_size 50M;
}

location /_synapse {
    proxy_pass http://localhost:8008;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
}
EOF

echo "✓ Created Synapse proxy configuration"
echo ""
echo "You need to include this in your main call.fst.gs Nginx server block."
echo ""
echo "Add this line inside your server block:"
echo "  include /etc/nginx/sites-available/synapse-proxy;"
echo ""
echo "Then reload Nginx:"
echo "  systemctl reload nginx"
echo ""
echo "Test if Synapse is accessible:"
echo "  curl https://call.fst.gs/_matrix/client/versions"
