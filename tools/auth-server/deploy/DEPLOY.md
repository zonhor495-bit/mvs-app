# Deployment instructions for VPS

This document explains how to deploy the MVS Auth Server on a VPS using systemd + Nginx + Let's Encrypt. It assumes a Linux VPS (Ubuntu/Debian recommended).

Summary of choices (per your request):
- SQLite path: `/var/lib/mvs/auth.db`
- Node.js backend: runs as `mvs` user
- systemd unit: `/etc/systemd/system/mvs-auth.service` (template in this repo)
- bind address: `127.0.0.1:4000` (only accessible via localhost)
- reverse proxy: Nginx (public HTTPS on `auth.example.com`)
- CORS: configured via `AUTH_ALLOWED_ORIGIN` env var
- JWT_SECRET: taken from environment (never committed to git)

1) Prepare VPS (run as root or with sudo)

```bash
# Install Node.js (use NodeSource or distro packages)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx

# Create mvs user
useradd --system --create-home --home-dir /var/lib/mvs mvs || true

# Create DB directory and set ownership
mkdir -p /var/lib/mvs
chown mvs:mvs /var/lib/mvs

# Create working directory for app (recommended path)
mkdir -p /opt/mvs-auth-server
chown -R mvs:mvs /opt/mvs-auth-server

# Copy repo files to /opt/mvs-auth-server (git clone or rsync)
# Example (on VPS):
# git clone <repo> /opt/mvs-auth-server
# or rsync from build machine
```

2) Create environment file `/etc/mvs/auth.env`

```
# Example /etc/mvs/auth.env (DO NOT commit this file)
JWT_SECRET=<generate-a-long-random-secret>
DB_FILE=/var/lib/mvs/auth.db
PORT=4000
BIND_ADDR=127.0.0.1
AUTH_ALLOWED_ORIGIN=https://app.example.com
TOKEN_EXPIRY=7d

# For logging or additional flags you can add
```

Ensure permissions:

```bash
mkdir -p /etc/mvs
chown root:root /etc/mvs
chmod 640 /etc/mvs/auth.env
```

3) Install dependencies and start service

```bash
cd /opt/mvs-auth-server
npm install --production

# Copy systemd unit template to system
cp tools/auth-server/deploy/mvs-auth.service /etc/systemd/system/mvs-auth.service

# Reload systemd and start
systemctl daemon-reload
systemctl enable --now mvs-auth.service

# Check status
systemctl status mvs-auth.service
journalctl -u mvs-auth.service -f
```

4) Configure Nginx and HTTPS

```bash
# Copy nginx config and update server_name
cp tools/auth-server/deploy/nginx_auth.conf /etc/nginx/sites-available/mvs-auth.conf
ln -s /etc/nginx/sites-available/mvs-auth.conf /etc/nginx/sites-enabled/mvs-auth.conf
nginx -t && systemctl reload nginx

# Use certbot to obtain certificate
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d auth.example.com

# After certbot runs, Nginx will be configured for HTTPS and proxying to 127.0.0.1:4000
```

5) Validate API (sample curl commands)

```bash
# Replace host with your domain
HOST=https://auth.example.com

# Register
curl -s -X POST "$HOST/api/register" -H 'Content-Type: application/json' -d '{"username":"testuser","passwordHash":"testpw","name":"Test User"}' | jq

# Login
curl -s -X POST "$HOST/api/login" -H 'Content-Type: application/json' -d '{"username":"testuser","passwordHash":"testpw"}' | jq

# Use the returned token for /api/me and DELETE /api/me
```

6) Persistence test

After creating a user, stop the service and start it again and verify login still works.

```bash
systemctl stop mvs-auth.service
systemctl start mvs-auth.service
# Then repeat login curl — user should remain in database
```

7) Notes

- `JWT_SECRET` must be secure and long (do not expose it)
- `DB_FILE` points to a persistent location (`/var/lib/mvs/auth.db`)
- `AUTH_ALLOWED_ORIGIN` should be set to the public origin of your app (or Electron origin if applicable)
- When backend is reachable at `https://auth.example.com`, provide that URL and I will embed it into the app and rebuild the Windows installer.
