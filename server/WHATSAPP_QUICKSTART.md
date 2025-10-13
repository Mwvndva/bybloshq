# WhatsApp Integration - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Start the Server
```bash
cd server
npm start
```

You'll see:
```
📱 Initializing WhatsApp service...
🔄 Initializing WhatsApp client...
```

### Step 2: Scan QR Code

**In Terminal** (Look for the QR code pattern in your console)
```
█████████████████████████████
█████████████████████████████
███ ▄▄▄▄▄ █▀ █▀▀██ ▄▄▄▄▄ ███
███ █   █ █▀ █  ▀█ █   █ ███
███ █▄▄▄█ ██▀▀ ▀██ █▄▄▄█ ███
```

1. Open WhatsApp on your phone
2. Go to **Settings → Linked Devices**
3. Tap **Link a Device**
4. Scan the QR code from your terminal

### Step 3: Wait for Confirmation
```
✅ WhatsApp client is ready!
```

That's it! 🎉 WhatsApp notifications are now active.

---

## 🧪 Test It

### Test 1: Check Status
```bash
# Replace YOUR_ADMIN_TOKEN with actual token
curl http://localhost:3002/api/whatsapp/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "message": "WhatsApp is connected"
  }
}
```

### Test 2: Send Test Message
```bash
curl -X POST http://localhost:3002/api/whatsapp/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0712345678",
    "message": "Hello! This is a test message from Byblos."
  }'
```

### Test 3: Create Order (Automatic Notification)
Make a purchase through the platform - both buyer and seller will receive WhatsApp notifications automatically!

---

## 📱 What Gets Sent?

### When a New Order is Created:
✅ **Seller** receives: Order details, customer info, items list  
✅ **Buyer** receives: Order confirmation, seller contact, delivery info

### When Order Status Changes:
✅ **Buyer** receives: Status update with helpful messages  
✅ **Seller** receives: Status change confirmation

---

## ⚠️ Common Issues

### Issue: "WhatsApp client is not ready"
**Solution:** Scan the QR code again
```bash
curl -X POST http://localhost:3002/api/whatsapp/initialize \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Issue: QR Code expired
**Solution:** Restart the server or reinitialize

### Issue: Phone number invalid
**Solution:** Use format: `0712345678` or `+254712345678`

---

## 🔧 Phone Number Formats

All these work:
- `0712345678` ✅
- `+254712345678` ✅
- `254712345678` ✅
- `712345678` ✅

The system auto-converts to `254712345678@c.us`

---

## 📊 Monitor Logs

Watch for these messages:
```
📤 Sending WhatsApp message to 0712345678
✅ WhatsApp message sent successfully
```

If you see:
```
⚠️ WhatsApp client is not ready
```
Scan the QR code again!

---

## 🎯 Next Steps

1. ✅ Scan QR code
2. ✅ Test with a message
3. ✅ Create a test order
4. ✅ Update order status
5. 🎉 Notifications working!

---

## 📖 Full Documentation

See `WHATSAPP_INTEGRATION.md` for:
- API endpoints
- Message templates
- Customization
- Production deployment
- Troubleshooting

---

**Need Help?** Check the logs or use `/api/whatsapp/status`

