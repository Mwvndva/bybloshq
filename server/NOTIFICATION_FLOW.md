# 📱 WhatsApp Notification Flow

This document outlines the **exact** WhatsApp notifications sent at each stage of the order lifecycle.

---

## 🎯 Notification Events

### 0️⃣ **Order Cancelled**

**Trigger:** When a buyer or seller cancels an order  
**Location:** `server/src/controllers/order.controller.js` (in the `cancelOrder` and `sellerCancelOrder` methods)

#### 📤 Buyer Receives:
```
❌ ORDER CANCELLED

Your order has been cancelled [by the seller].

📦 Order #67
💰 Amount: KSh 1,500

---
📦 CANCELLED ITEMS
1. Product Name - KSh 1,500 x2

---
💵 REFUND INFORMATION
A full refund of KSh 1,500 has been added to your account balance.

You can request a withdrawal from your refund balance in your buyer dashboard.

If you have any questions, please contact our support team.

---
Byblos Marketplace
```

#### 📤 Seller Receives:
**When Seller Cancels:**
```
❌ ORDER CANCELLATION CONFIRMED

You have successfully cancelled this order.

📦 Order #67
💰 Amount: KSh 1,500

---
📦 CANCELLED ITEMS
1. Product Name - KSh 1,500 x2

---
ℹ️ INFORMATION
The buyer has been refunded the full order amount.

Please ensure you do not prepare or ship this order.

---
Byblos Marketplace
```

**When Buyer Cancels:**
```
❌ ORDER CANCELLED BY BUYER

The buyer has cancelled this order.

📦 Order #67
💰 Amount: KSh 1,500

---
📦 CANCELLED ITEMS
1. Product Name - KSh 1,500 x2

---
ℹ️ INFORMATION
The buyer has been refunded the full order amount.

Please ensure you do not prepare or ship this order.

---
Byblos Marketplace
```

#### 📤 Logistics Partner Receives:
```
❌ ORDER CANCELLED

An order has been cancelled [by buyer/seller].

📦 Order #67
💰 Amount: KSh 1,500

---
👤 BUYER INFORMATION
Name: John Doe
Phone: +254712345678
Email: buyer@example.com
Location: Nairobi, Kasarani

---
🏪 SELLER INFORMATION
Shop: Tech Store
Phone: +254798765432
Email: seller@example.com

---
📦 CANCELLED ITEMS
1. Product Name - KSh 1,500 x2

---
⚠️ IMPORTANT:
• Do NOT process pickup or delivery for this order
• Both parties have been notified
• Buyer has been refunded

---
Byblos Marketplace
```

---

### 1️⃣ **Order Created** (Payment Successful)

**Trigger:** When a buyer **successfully completes payment** via Pesapal (not just initiates it)  
**Location:** `server/src/controllers/pesapal.controller.js:546` (in the `callback` method)  
**Important:** Notifications are sent ONLY after Pesapal confirms payment is successful

#### 📤 Seller Receives:
```
🎉 NEW ORDER RECEIVED!

You have a new order!

📦 Order Details:
Order #: ORD-2025-001
💰 Total: KSh 1,500

📋 Items:
1. Product Name x2 - KSh 1,500

⏰ Order Time: Oct 7, 2025, 10:30 AM

📍 DROP-OFF LOCATION:
Dynamic Mall, Tom Mboya St, Nairobi, Kenya
Shop: SL 32

⚠️ IMPORTANT INSTRUCTIONS:
1. Package the item according to Order #ORD-2025-001
2. Drop it off at the location above in good condition
3. After drop-off, click "Ready for Pickup" button in the app to notify the buyer
4. Complete drop-off within 48 hours or the order will be cancelled automatically

This ensures your sale is completed successfully! ✅

---
Byblos Platform
```

#### 📤 Buyer Receives:
```
✅ ORDER CONFIRMED!

Hi! 👋

Thank you for your order!

📦 Order Details:
Order #: ORD-2025-001
💰 Total: KSh 1,500

📋 Items:
1. Product Name x2 - KSh 1,500

⏰ Order Time: Oct 7, 2025, 10:30 AM

We'll notify you when your order is ready for pickup!

---
Byblos Platform
```

---

### 2️⃣ **Status Changed to READY_FOR_PICKUP**

**Trigger:** When seller updates order status to "Ready for Pickup"  
**Location:** `server/src/controllers/order.controller.js:762`

#### 📤 Buyer Receives:
```
📦 ORDER READY FOR PICKUP!

Hi! 👋

Great news! Your order is ready for collection.

📦 Order Details:
Order #: ORD-2025-001
💰 Amount: KSh 1,500

📍 PICKUP LOCATION:
Dynamic Mall, Tom Mboya St, Nairobi, Kenya
Shop: SL 32

📞 Next Steps:
1. Visit the pickup location above
2. Ask for your package using Order #ORD-2025-001
3. Inspect the item to ensure it's what you ordered and in good condition
4. Once satisfied, confirm receipt in the app to complete the order

💬 Note: Your order is packed and ready!

⏰ Ready Since: Oct 7, 2025, 2:00 PM

⚠️ IMPORTANT:
• Only confirm the order after inspecting your package!
• Pick up within 48 hours or the package will be returned

---
Byblos Platform
```

#### 📤 Seller Receives:
```
✅ BUYER NOTIFIED

Hi! The buyer has been notified that their order is ready for pickup.

📦 Order Details:
Order #: ORD-2025-001

The buyer will contact you to arrange pickup.

⏰ Notified: Oct 7, 2025, 2:00 PM

---
Byblos Platform
```

---

### 3️⃣ **Order Completed** (Buyer Confirms Receipt)

**Trigger:** When buyer clicks "Confirm Receipt" button  
**Location:** `server/src/controllers/order.controller.js` (in the `confirmReceipt` method, line ~964)

#### 📤 Buyer Receives:
```
🎉 THANK YOU!

Hi! 👋

Your order has been completed successfully!

📦 Order Details:
Order #: ORD-2025-001
💰 Total: KSh 1,500

Thank you for shopping with us! We hope you love your purchase! ❤️

We'd love to hear your feedback. Please rate your experience on our platform.

Looking forward to serving you again! 🛍️

⏰ Completed: Oct 7, 2025, 4:30 PM

---
Byblos Platform
```

#### 📤 Seller Receives:
```
🎉 ORDER COMPLETED

Order has been marked as completed!

📦 Order Details:
Order #: ORD-2025-001
💰 Amount: KSh 1,500

Thank you for fulfilling this order! 🙏

⏰ Completed: Oct 7, 2025, 4:30 PM

---
Byblos Platform
```

---

## 📊 Notification Matrix

| Event | Buyer Gets | Seller Gets | Logistics Gets | Trigger |
|-------|-----------|-------------|----------------|---------|
| **Order Cancelled** | ❌ Cancellation notice + refund info | ❌ Cancellation confirmation + reason | ❌ Cancellation alert + do not process | Buyer/Seller cancels |
| **Order Created** | ✅ Order confirmation | 🎉 New order alert with 48hr deadline | 📦 New order with buyer/seller details | Payment success |
| **Status: READY_FOR_PICKUP** | 📦 Pickup details + 48hr deadline | ✅ "Buyer notified" confirmation | - | Seller updates status |
| **Status: COMPLETED** | 🎉 Thank you message | 🎉 Order completed notification | - | Buyer clicks "Confirm Receipt" |

---

## 🔄 Complete Order Flow

```
1. Buyer clicks "Buy Now"
   ↓
2. Order created in database (PENDING status)
   ↓
3. Redirected to Pesapal payment page
   ↓
4. Buyer completes payment
   ↓
5. Pesapal callback confirms payment SUCCESS
   ↓
6. 📱 Seller: "New order received!"
   📱 Buyer: "Order confirmed!"
   📱 Logistics: "New order details"
   ↓
7. Seller prepares order
   ↓
8. Seller clicks "Ready for Pickup"
   ↓
9. 📱 Buyer: "Order ready + pickup details"
   📱 Seller: "Buyer has been notified"
   ↓
10. Buyer collects order
   ↓
11. Buyer clicks "Confirm Receipt"
   ↓
12. 📱 Buyer: "Thank you message"
    📱 Seller: "Order completed"

--- ALTERNATIVE FLOW: CANCELLATION ---

At any point before completion:
   ↓
X. Buyer OR Seller clicks "Cancel Order"
   ↓
   📱 Buyer: "Order cancelled + refund info"
   📱 Seller: "Order cancelled + reason"
   📱 Logistics: "Order cancelled - do not process"
```

---

## 🎨 Message Features

### Buyer Messages Include:
- ✅ Order number and total amount
- ✅ Order items list
- ✅ Clear next steps
- ✅ Friendly greeting
- ❌ NO buyer personal details shared
- ❌ NO seller contact information

### Seller Messages Include:
- ✅ Order number and amount
- ✅ Order items list (for new orders)
- ✅ Confirmation of buyer notification
- ✅ Professional tone
- ✅ Action status updates
- ❌ NO buyer contact information
- ❌ NO seller personal details

---

## 🔧 Technical Details

### Payment Verification First
- Notifications are sent ONLY after Pesapal confirms payment success
- Prevents sending notifications for failed/cancelled payments
- Located in `callback` method, not `checkout` method
- Checks for status: `COMPLETED` or `PAID`

```javascript
// Only send if payment successful
if (upperStatus === 'COMPLETED' || upperStatus === 'PAID') {
  logger.info('Payment successful - sending WhatsApp notifications');
  this.sendOrderNotifications(fullOrder, items, customer, sellerId).catch(err => {
    logger.error('Error sending WhatsApp notifications after payment:', err);
  });
}
```

### Non-Blocking
All notifications are sent asynchronously and won't block the order process:
```javascript
sendOrderStatusNotifications(order, updatedOrder, status).catch(err => {
  console.error('Error sending WhatsApp notifications:', err);
});
```

### Graceful Failure
- If WhatsApp service is down, orders still process normally
- Errors are logged but don't affect user experience
- Phone number validation happens before sending

### Automatic Retry
- WhatsApp service has built-in retry logic
- Session management for persistent connection
- QR code regeneration on disconnection

---

## 📝 Notes

1. **4 main notification types** (as per requirements):
   - Order created (after successful payment)
   - Order cancelled (by buyer or seller)
   - Ready for pickup
   - Order completed

2. **Cancellation handling:**
   - Buyer and seller get different messages depending on who cancelled
   - Refund information included in buyer's message
   - Logistics partner always notified to prevent processing

3. **Phone format:** All phone numbers are normalized to handle +254/0 prefixes

4. **Message timestamps:** All messages include local timestamps

5. **Non-blocking:** Notification failures don't prevent order processing

---

## 🧪 Testing

To test notifications:

1. **Create an order** → Check buyer, seller, and logistics phones
2. **Cancel an order (as buyer)** → Check all 3 parties receive cancellation notices
3. **Cancel an order (as seller)** → Check all 3 parties receive cancellation notices
4. **Mark as Ready for Pickup** → Check pickup details in buyer message
5. **Confirm Receipt** → Check thank you and completion messages

Check server logs for:
```
📤 Sending buyer cancellation notification for Order #67
📤 Sending seller cancellation notification for Order #67
📤 Sending logistics cancellation notification for Order #67
✅ WhatsApp message sent successfully
```

---

*Last Updated: October 7, 2025*

