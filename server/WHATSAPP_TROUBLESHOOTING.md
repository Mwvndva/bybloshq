# WhatsApp Integration Troubleshooting

## Error: "Execution context was destroyed"

This is a common error on Windows with `whatsapp-web.js`. Here are solutions:

### Solution 1: Restart with Updated Configuration ✅

The configuration has been updated with better Windows support. Restart your server:

```bash
cd server
npm start
```

The service will now:
- ✅ Use increased timeouts (60s connection, 120s protocol)
- ✅ Retry up to 3 times automatically
- ✅ Use remote web version cache
- ✅ Disable automation detection

### Solution 2: Manual Initialization

If automatic initialization fails, initialize manually:

```bash
# Stop your server (Ctrl+C)

# Delete sessions
Remove-Item -Path "server\whatsapp-sessions" -Recurse -Force -ErrorAction SilentlyContinue

# Start server (WhatsApp auto-init will be skipped if it fails)
cd server
npm start

# Then call the API to initialize
curl -X POST http://localhost:3002/api/whatsapp/initialize
```

### Solution 3: Use Without WhatsApp (Optional)

If WhatsApp keeps failing, the platform will still work! Notifications just won't be sent via WhatsApp.

The server logs will show:
```
⚠️  WhatsApp initialization failed
ℹ️  WhatsApp notifications will be unavailable
```

Your application continues to function normally - orders, payments, everything works!

### Solution 4: Check System Requirements

1. **Update Chrome/Chromium**
   ```bash
   # Puppeteer needs an up-to-date Chromium
   npm install puppeteer --force
   ```

2. **Check Node.js Version**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

3. **Clear npm cache**
   ```bash
   npm cache clean --force
   cd server
   npm install
   ```

### Solution 5: Use Headful Mode (Development Only)

For testing, you can run in headful mode to see what's happening:

Edit `server/src/services/whatsapp.service.js` and change:
```javascript
headless: true,  // Change to false
```

This will open a visible Chrome window showing the WhatsApp Web interface.

### Solution 6: Alternative - Use External WhatsApp Service

If the integration continues to be problematic, consider these alternatives:

1. **Twilio WhatsApp API** (Paid, but very reliable)
2. **WhatsApp Business API** (Official, requires approval)
3. **SMS Notifications** (Fallback option)

We can help you integrate any of these if needed!

### Common Windows-Specific Issues

#### Issue: Puppeteer won't install
```bash
# Set environment variable
$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="false"
cd server
npm install puppeteer
```

#### Issue: Port conflicts
```bash
# Find and kill process on port 3002
Get-Process -Id (Get-NetTCPConnection -LocalPort 3002).OwningProcess | Stop-Process -Force
```

#### Issue: Permission denied
```bash
# Run PowerShell as Administrator
# Then navigate to your project and start server
```

### Verification Steps

1. **Check if WhatsApp is ready:**
   ```bash
   curl http://localhost:3002/api/whatsapp/status -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Watch server logs:**
   Look for:
   - ✅ `WhatsApp client is ready!` - Success!
   - ⚠️  `WhatsApp initialization failed` - Needs troubleshooting
   - 📱 `QR Code received` - Ready to scan

3. **Test message sending:**
   ```bash
   curl -X POST http://localhost:3002/api/whatsapp/test \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"phone":"0712345678","message":"Test"}'
   ```

### When to Ask for Help

If after trying all solutions above WhatsApp still doesn't work:

1. Share your Node.js version: `node --version`
2. Share your OS: `systeminfo | findstr /B /C:"OS Name"`
3. Share the full error from server logs
4. Share if you're behind a proxy/firewall

### Working Without WhatsApp

The platform is designed to work with or without WhatsApp:

✅ **Works normally:**
- Order creation
- Order management
- Payments
- All other features

❌ **Not available:**
- WhatsApp notifications (obviously)

You can always:
- Send email notifications instead
- Use SMS gateway
- Use in-app notifications
- Manually contact customers

---

**Remember:** WhatsApp notifications are a nice-to-have feature, not critical! Your platform works perfectly without them.

