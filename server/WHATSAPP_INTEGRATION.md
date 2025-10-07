# WhatsApp Notifications Integration

This document explains the WhatsApp notifications integration for the Byblos platform using `whatsapp-web.js`.

## 🎯 Features

- ✅ Automatic notifications for new orders to sellers
- ✅ Order confirmation messages to buyers
- ✅ Real-time order status updates to both buyers and sellers
- ✅ QR code authentication for WhatsApp Web
- ✅ Non-blocking async notifications
- ✅ Phone number formatting for Kenyan numbers (+254)

## 📋 Prerequisites

- Node.js >= 18.0.0
- WhatsApp account
- Active internet connection
- Phone to scan QR code

## 🚀 Setup

### 1. Dependencies
The required package is already installed in `package.json`:
```json
"whatsapp-web.js": "^1.34.1"
```

### 2. Initialize WhatsApp

The WhatsApp service automatically initializes when the server starts. You'll see:

```
📱 Initializing WhatsApp service...
🔄 Initializing WhatsApp client...
📱 QR Code received. Scan with WhatsApp:
```

### 3. Scan QR Code

**Option A: Terminal (Development)**
- A QR code will appear in your terminal
- Open WhatsApp on your phone
- Go to Settings > Linked Devices > Link a Device
- Scan the QR code from the terminal

**Option B: API Endpoint (Production)**
```bash
# Get QR code as string
GET /api/whatsapp/qr
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "qrCode": "2@...",
    "message": "Scan this QR code with WhatsApp"
  }
}
```

## 🔌 API Endpoints

### Check Connection Status
```http
GET /api/whatsapp/status
Authorization: Bearer <seller/admin_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "qrCode": null,
    "message": "WhatsApp is connected"
  }
}
```

### Get QR Code
```http
GET /api/whatsapp/qr
Authorization: Bearer <admin_token>
```

### Initialize/Reinitialize
```http
POST /api/whatsapp/initialize
Authorization: Bearer <admin_token>
```

### Logout
```http
POST /api/whatsapp/logout
Authorization: Bearer <admin_token>
```

### Send Test Message
```http
POST /api/whatsapp/test
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "phone": "0712345678",
  "message": "Test message"
}
```

## 📱 Notification Types

### 1. New Order Notification (to Seller)

Sent automatically when a new order is created.

```
🎉 *NEW ORDER RECEIVED!*

📦 *Order #ORD-2024-001*
💰 *Total:* KSh 5,000

👤 *Customer Details:*
Name: John Doe
Phone: 0712345678
Email: john@example.com
Location: Nairobi, Westlands

📋 *Items:*
1. Product Name x2 - KSh 2,500
2. Another Product x1 - KSh 2,500

⏰ *Order Time:* 07/10/2025, 10:30 AM

🔔 Please prepare this order for delivery.

---
Byblos Platform
```

### 2. Order Confirmation (to Buyer)

Sent automatically when a new order is created.

```
✅ *ORDER CONFIRMED!*

Hi John Doe! 👋

Your order has been confirmed and is being processed.

📦 *Order #ORD-2024-001*
💰 *Total:* KSh 5,000
📍 *Status:* PENDING

📋 *Your Items:*
1. Product Name x2 - KSh 2,500
2. Another Product x1 - KSh 2,500

🏪 *Seller:* Jane's Store
📞 *Seller Contact:* 0723456789

⏰ *Order Time:* 07/10/2025, 10:30 AM

We'll notify you when your order status changes.

Thank you for shopping with us! 🛍️

---
Byblos Platform
```

### 3. Status Update (to Buyer)

Sent when order status changes.

```
📦 *ORDER STATUS UPDATE*

Hi John Doe! 👋

Your order status has been updated:

📦 *Order #ORD-2024-001*
🔄 *Status:* PENDING → *READY_FOR_PICKUP*

🏪 Your order is ready for pickup! Please contact the seller to arrange collection.

⏰ *Updated:* 07/10/2025, 2:00 PM

---
Byblos Platform
```

### 4. Status Update (to Seller)

Sent when order status changes.

```
📋 *ORDER STATUS UPDATED*

Order #ORD-2024-001 status changed:

🔄 PENDING → *READY_FOR_PICKUP*

⏰ Updated: 07/10/2025, 2:00 PM

---
Byblos Platform
```

## 🔧 Phone Number Formatting

The system automatically formats phone numbers for WhatsApp:

| Input | Output |
|-------|--------|
| `0712345678` | `254712345678@c.us` |
| `+254712345678` | `254712345678@c.us` |
| `254712345678` | `254712345678@c.us` |
| `712345678` | `254712345678@c.us` |

## 🎨 Status Emojis

| Status | Emoji |
|--------|-------|
| PENDING | ⏳ |
| PROCESSING | ⚙️ |
| READY_FOR_PICKUP | 📦 |
| SHIPPED | 🚚 |
| DELIVERED | ✅ |
| COMPLETED | 🎉 |
| CANCELLED | ❌ |

## 🔐 Session Management

WhatsApp sessions are stored in:
```
/whatsapp-sessions/
```

**Note:** This directory is in `.gitignore` - sessions are persistent but not tracked by git.

## 🐛 Troubleshooting

### QR Code Not Appearing
```bash
# Reinitialize WhatsApp
curl -X POST http://localhost:3002/api/whatsapp/initialize \
  -H "Authorization: Bearer <admin_token>"
```

### Connection Lost
- Check internet connection
- Ensure your phone's WhatsApp is connected
- Try logging out and re-authenticating:
```bash
curl -X POST http://localhost:3002/api/whatsapp/logout \
  -H "Authorization: Bearer <admin_token>"

curl -X POST http://localhost:3002/api/whatsapp/initialize \
  -H "Authorization: Bearer <admin_token>"
```

### Messages Not Sending
1. Check connection status:
```bash
curl http://localhost:3002/api/whatsapp/status \
  -H "Authorization: Bearer <admin_token>"
```

2. Test with a manual message:
```bash
curl -X POST http://localhost:3002/api/whatsapp/test \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "0712345678", "message": "Test"}'
```

3. Check server logs for errors

### Session Expired
Delete the session directory and re-authenticate:
```bash
rm -rf whatsapp-sessions/
# Server will generate new QR code automatically
```

## ⚙️ Configuration

### Environment Variables
No additional environment variables required. WhatsApp service uses existing configuration.

### Customization

To customize message templates, edit:
```
server/src/services/whatsapp.service.js
```

Methods:
- `notifySellerNewOrder()`
- `notifyBuyerOrderConfirmation()`
- `notifyBuyerStatusUpdate()`
- `notifySellerStatusUpdate()`

## 📊 Monitoring

Check WhatsApp status in application logs:
```
✅ WhatsApp client is ready!
📤 Sending WhatsApp message to 0712345678 (254712345678@c.us)
✅ WhatsApp message sent successfully to 0712345678
```

## 🚀 Production Deployment

### On Render.com / Similar Platforms:

1. **Persistent Storage**: WhatsApp sessions need persistent storage. Configure a volume mount for `/whatsapp-sessions/`

2. **Initial Setup**: After deployment, use the QR endpoint to authenticate:
   - Call `/api/whatsapp/qr` from admin panel
   - Display QR code
   - Scan with WhatsApp
   - Session persists across restarts

3. **Health Checks**: Add WhatsApp status to health check endpoint

## 🔒 Security

- ✅ QR code endpoint requires admin authentication
- ✅ Status endpoint requires seller/admin authentication
- ✅ Session files are not committed to git
- ✅ Notifications are non-blocking (won't crash server if WhatsApp fails)
- ✅ Phone numbers are validated before sending

## 📝 Integration Points

### New Orders
File: `server/src/controllers/pesapal.controller.js`
```javascript
// After order commit
this.sendOrderNotifications(order, items, customer, sellerId);
```

### Status Updates
File: `server/src/controllers/order.controller.js`
```javascript
// After status update commit
sendOrderStatusNotifications(order, updatedOrder, status);
```

## 🎯 Future Enhancements

- [ ] Support for order images/attachments
- [ ] Delivery tracking links
- [ ] Customer support chat integration
- [ ] Automated responses
- [ ] Multi-language support
- [ ] Message templates management UI
- [ ] Delivery confirmation via WhatsApp
- [ ] Payment reminders

## 📞 Support

For issues or questions about WhatsApp integration:
1. Check server logs
2. Verify WhatsApp connection status
3. Test with manual message endpoint
4. Review phone number format

---

**Last Updated:** October 7, 2025
**Version:** 1.0.0

