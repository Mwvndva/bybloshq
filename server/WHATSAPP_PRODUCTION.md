# WhatsApp Integration - Production Deployment Guide

## Issue: Missing Chromium Dependencies

When deploying to production (Docker/Render/etc.), you may encounter this error:

```
Failed to launch the browser process!
libgobject-2.0.so.0: cannot open shared object file: No such file or directory
```

This occurs because WhatsApp Web.js uses Puppeteer/Chromium which requires system libraries not included in slim base images.

## Solution 1: Update Dockerfile (✅ Recommended)

The `Dockerfile` has been updated to include all required Chromium dependencies:

```dockerfile
FROM node:18-slim

# Install Chromium dependencies for Puppeteer/WhatsApp
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
```

**After updating Dockerfile:**
1. Rebuild your Docker image
2. Redeploy to production
3. WhatsApp should initialize successfully

## Solution 2: Disable WhatsApp (Temporary)

If you need to deploy quickly without WhatsApp features:

1. Set environment variable:
   ```bash
   DISABLE_WHATSAPP=true
   ```

2. Or modify `server/src/index.js` to skip WhatsApp initialization

## Solution 3: Use Different Base Image

Alternative: Use `node:18` (full image) instead of `node:18-slim`:

```dockerfile
FROM node:18
```

**Pros**: All dependencies included  
**Cons**: Larger image size (~900MB vs ~180MB)

## Verifying WhatsApp Status

After deployment, check WhatsApp status:

```bash
GET /api/whatsapp/status
```

Response:
```json
{
  "status": "ready",
  "message": "WhatsApp client is ready"
}
```

Or if not ready:
```json
{
  "status": "not_ready",
  "message": "WhatsApp client is not initialized",
  "qrCode": "https://..." // if QR code is available
}
```

## QR Code Authentication

1. **First Time Setup**:
   - Access `/api/whatsapp/qr` to get QR code
   - Scan with WhatsApp mobile app
   - Session will be saved for future deployments

2. **Persistent Sessions**:
   - Sessions are stored in `whatsapp-sessions/` directory
   - Mount this as a persistent volume in production
   - Prevents re-authentication on each deployment

### Render.com Example:
```yaml
services:
  - type: web
    name: byblos-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    disk:
      name: whatsapp-sessions
      mountPath: /app/whatsapp-sessions
      sizeGB: 1
```

## Troubleshooting

### Error: "Port already in use"
- Render auto-assigns ports, don't hardcode 3002
- Use `process.env.PORT || 3002`

### Error: "Session timeout"
- Increase Puppeteer timeout in `whatsapp.service.js`
- Current: 60s, increase to 120s if needed

### Error: "QR code not generating"
- Clear sessions: `rm -rf whatsapp-sessions/`
- Restart server
- Access `/api/whatsapp/initialize`

### Performance Issues
- WhatsApp uses ~200MB RAM when active
- Ensure your server has at least 512MB available
- Consider upgrading if you see memory errors

## Graceful Degradation

The application is designed to work without WhatsApp:

- ✅ Orders still process normally
- ✅ Emails are sent as fallback
- ✅ All features remain functional
- ⚠️ No WhatsApp notifications sent

WhatsApp is an **enhancement**, not a requirement.

## Production Checklist

- [ ] Dockerfile updated with Chromium dependencies
- [ ] Persistent volume mounted for sessions
- [ ] Environment variables configured
- [ ] QR code scanned and authenticated
- [ ] Test notifications working
- [ ] Monitor memory usage
- [ ] Set up alerts for WhatsApp disconnections

## Support

For issues specific to WhatsApp Web.js:
- GitHub: https://github.com/pedroslopez/whatsapp-web.js
- Documentation: https://wwebjs.dev/

For Puppeteer/Chromium issues:
- Troubleshooting: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md

