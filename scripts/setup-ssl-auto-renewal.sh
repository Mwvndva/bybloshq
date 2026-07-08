#!/usr/bin/env bash
# =============================================================================
# setup-ssl-auto-renewal.sh — Install a cron job to auto-renew SSL every 60 days
#
# Run ONCE on the production VPS after initial cert is working.
# Certbot will attempt renewal daily but only act when cert is < 30 days from expiry.
#
# Usage (on VPS as root):
#   chmod +x scripts/setup-ssl-auto-renewal.sh
#   sudo ./scripts/setup-ssl-auto-renewal.sh /path/to/project
# =============================================================================
set -euo pipefail

DOMAIN="bybloshq.space"
PROJECT_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
SSL_DIR="$PROJECT_DIR/ssl"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
DEPLOY_HOOK="/etc/letsencrypt/renewal-hooks/deploy/byblos-docker.sh"

echo "==> Installing certbot deploy hook at $DEPLOY_HOOK..."
mkdir -p "$(dirname "$DEPLOY_HOOK")"

cat > "$DEPLOY_HOOK" <<HOOK
#!/usr/bin/env bash
# Auto-invoked by certbot after a successful renewal.
# Copies new certs into the Docker SSL volume mount and reloads nginx.
set -euo pipefail
DOMAIN="$DOMAIN"
SSL_DIR="$SSL_DIR"
CERT_PATH="$CERT_PATH"
PROJECT_DIR="$PROJECT_DIR"

echo "[certbot deploy hook] Copying renewed certs to \$SSL_DIR..."
mkdir -p "\$SSL_DIR"
cp -f "\$CERT_PATH/fullchain.pem" "\$SSL_DIR/fullchain.pem"
cp -f "\$CERT_PATH/privkey.pem"   "\$SSL_DIR/privkey.pem"
chmod 600 "\$SSL_DIR/privkey.pem"
chmod 644 "\$SSL_DIR/fullchain.pem"

echo "[certbot deploy hook] Reloading nginx container..."
cd "\$PROJECT_DIR"
docker compose kill -s HUP nginx

echo "[certbot deploy hook] Done. New expiry: \$(openssl x509 -enddate -noout -in \$SSL_DIR/fullchain.pem)"
HOOK

chmod +x "$DEPLOY_HOOK"

echo "==> Installing daily certbot cron job..."
CRON_JOB="0 3 * * * certbot renew --quiet 2>&1 | logger -t certbot"
( crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_JOB" ) | crontab -

echo ""
echo "✅  Auto-renewal configured."
echo "    Deploy hook: $DEPLOY_HOOK"
echo "    Cron: runs daily at 03:00, renews when cert is within 30 days of expiry."
echo "    Test with: certbot renew --dry-run"
