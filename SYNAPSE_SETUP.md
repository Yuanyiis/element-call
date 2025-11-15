# Synapse Homeserver Setup for BME Helper

## Problem

The default Matrix homeserver (matrix.org) has disabled guest and open registration. This prevents the BME Helper app from automatically logging in users.

**Error you see:**
```
MatrixError: [403] Registration has been disabled.
```

## Solution

Deploy your own Synapse homeserver with guest registration enabled.

---

## Quick Setup (5 minutes)

### 1. Deploy Synapse on your server

```bash
# Run the deployment script
curl -fsSL https://raw.githubusercontent.com/Yuanyiis/element-call/claude/review-project-docs-01MccRDcsfwy7FzpBSBzeBQ2/deploy-synapse.sh | bash
```

This will:
- Install Docker
- Deploy Synapse with PostgreSQL
- Enable guest registration
- Configure for BME Helper usage

### 2. Update Element Call configuration

Create/update `/opt/bme-helper/config.json`:

```json
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "http://call.fst.gs:8008",
      "server_name": "call.fst.gs"
    }
  }
}
```

### 3. Rebuild and restart

```bash
cd /opt/bme-helper
npm run build
systemctl reload nginx
```

### 4. Test

Visit `https://call.fst.gs` and select a role. It should now automatically register users!

---

## Nginx Reverse Proxy (Optional - for HTTPS)

If you want Synapse accessible via HTTPS, add this to your Nginx config:

```nginx
# Add to /etc/nginx/sites-available/bme-helper

location /_matrix {
    proxy_pass http://localhost:8008;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
}

location /_synapse {
    proxy_pass http://localhost:8008;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
}
```

Then update config.json to use HTTPS:

```json
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://call.fst.gs",
      "server_name": "call.fst.gs"
    }
  }
}
```

---

## Management Commands

```bash
# View logs
docker-compose -f /opt/synapse/docker-compose.yml logs -f synapse

# Restart Synapse
docker-compose -f /opt/synapse/docker-compose.yml restart

# Stop Synapse
docker-compose -f /opt/synapse/docker-compose.yml stop

# Start Synapse
docker-compose -f /opt/synapse/docker-compose.yml start

# Check status
docker-compose -f /opt/synapse/docker-compose.yml ps
```

---

## Troubleshooting

### Synapse not starting

```bash
# Check logs
docker-compose -f /opt/synapse/docker-compose.yml logs synapse

# Common issue: port already in use
netstat -tuln | grep 8008
# If something is using port 8008, change it in docker-compose.yml
```

### Registration still failing

Check Synapse logs for errors:
```bash
docker-compose -f /opt/synapse/docker-compose.yml logs synapse | grep -i error
```

Verify configuration:
```bash
cat /opt/synapse/data/homeserver.yaml | grep -A5 enable_registration
```

Should show:
```yaml
enable_registration: true
enable_registration_without_verification: true
allow_guest_access: true
```

### Test Synapse directly

```bash
# Check if Synapse is responding
curl http://localhost:8008/_matrix/client/versions

# Try to register a test user
curl -X POST http://localhost:8008/_matrix/client/v3/register \
  -H "Content-Type: application/json" \
  -d '{
    "auth": {"type": "m.login.dummy"},
    "username": "test_user",
    "password": "test123"
  }'
```

---

## Security Notes

For production use, you should:

1. **Use HTTPS** - Set up SSL/TLS with Let's Encrypt
2. **Enable rate limiting** - Prevent abuse (already configured)
3. **Set up registration tokens** - Require tokens for registration (optional)
4. **Configure TURN server** - For better WebRTC connectivity
5. **Regular backups** - Backup PostgreSQL database

---

## Alternative: Use a Different Public Homeserver

Some public homeservers may allow registration. Update config.json:

```json
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://other-server.example.com",
      "server_name": "other-server.example.com"
    }
  }
}
```

But this is not recommended for production as these servers may change their policies.
