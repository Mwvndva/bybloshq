#!/usr/bin/env bash
# =============================================================================
# renew-ssl.sh — Renew the Let's Encrypt certificate for bybloshq.space
#
# Uses the WEBROOT authenticator so renewal works WITHOUT stopping nginx (the
# Dockerized nginx permanently holds port 80, which is why the old standalone
# auto-renewal failed silently and the cert expired -> NET::ERR_CERT_DATE_INVALID).
#
# Prerequisite (already wired in this repo): nginx serves
#   location /.well-known/acme-challenge/ { root /var/www/certbot; }
# and mounts ./certbot-webroot -> /var/www/certbot (see docker-compose.yml).
#
# Usage (on the production VPS as root):
#   chmod +x scripts/renew-ssl.sh
#   sudo ./scripts/renew-ssl.sh
# =============================================================================
set -euo pipefail

DOMAIN="bybloshq.space"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SSL_DIR="$PROJECT_DIR/ssl"
WEBROOT="$PROJECT_DIR/certbot-webroot"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

echo "==> Ensuring webroot exists and nginx is up to serve the ACME challenge..."
mkdir -p "$WEBROOT"
docker compose up -d nginx

echo "==> Issuing/renewing certificate for $DOMAIN via webroot (zero downtime)..."
# certonly --webroot also migrates the saved renewal config away from the broken
# standalone authenticator, so future `certbot renew` runs succeed too.
certbot certonly \
  --webroot -w "$WEBROOT" \
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

echo "==> Reloading nginx to pick up the new certificate (no downtime)..."
docker compose kill -s HUP nginx || docker compose restart nginx

echo ""
echo "✅  SSL certificate renewed successfully."
echo "    New expiry: $(openssl x509 -enddate -noout -in "$SSL_DIR/fullchain.pem")"
