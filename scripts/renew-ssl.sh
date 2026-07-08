#!/usr/bin/env bash
# =============================================================================
# renew-ssl.sh — Renew the Let's Encrypt certificate for bybloshq.space
#
# Run this script on the production VPS whenever the SSL cert has expired
# or is about to expire. It:
#   1. Runs certbot standalone renewal (stops nginx first, restarts after).
#   2. Copies the renewed certs into ./ssl/ (the Docker volume mount).
#   3. Restarts the nginx container to pick up the new certs.
#
# Usage:
#   chmod +x scripts/renew-ssl.sh
#   sudo ./scripts/renew-ssl.sh
# =============================================================================
set -euo pipefail

DOMAIN="bybloshq.space"
SSL_DIR="$(cd "$(dirname "$0")/.." && pwd)/ssl"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

echo "==> Stopping nginx container to free port 80..."
docker compose stop nginx

echo "==> Running certbot renewal for $DOMAIN..."
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --preferred-challenges http \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "==> Copying renewed certificates into $SSL_DIR..."
mkdir -p "$SSL_DIR"
cp -f "$CERT_PATH/fullchain.pem" "$SSL_DIR/fullchain.pem"
cp -f "$CERT_PATH/privkey.pem"   "$SSL_DIR/privkey.pem"
chmod 600 "$SSL_DIR/privkey.pem"
chmod 644 "$SSL_DIR/fullchain.pem"

echo "==> Restarting nginx container..."
docker compose start nginx

echo ""
echo "✅  SSL certificate renewed successfully."
echo "    New expiry: $(openssl x509 -enddate -noout -in "$SSL_DIR/fullchain.pem")"
