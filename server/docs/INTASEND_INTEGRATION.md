# IntaSend Payment Gateway Integration

This document explains how to configure and use IntaSend as the payment gateway for the Byblos application.

## Overview

IntaSend is a payment gateway that supports M-Pesa STK Push, card payments, and other payment methods. This integration replaces the existing Pesapal implementation.

## Features

- **Payment Collection**: Create payment links for customers
- **M-Pesa STK Push**: Direct M-Pesa payments via STK Push
- **Webhook Support**: Real-time payment status updates
- **Refund Support**: Process refunds through IntaSend
- **Multiple Payment Methods**: Support for various payment channels

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# IntaSend API Credentials
INTASEND_PUBLIC_KEY=your_intasend_public_key_here
INTASEND_SECRET_KEY=your_intasend_secret_key_here

# IntaSend Environment Configuration
# For development/testing:
INTASEND_BASE_URL=https://sandbox.intasend.com

# For production:
# INTASEND_BASE_URL=https://api.intasend.com
```

### Getting API Keys

1. Sign up at [IntaSend Developer Portal](https://developers.intasend.com/docs/introduction)
2. Create a new application
3. Get your Public Key and Secret Key
4. Configure webhook URLs in your IntaSend dashboard

## API Endpoints

### Initialize IntaSend
```
POST /api/intasend/initialize
```
Tests the IntaSend connection and configuration.

### Create Payment Collection
```
POST /api/intasend/checkout
```
Creates a payment collection for customers to pay via various methods.

**Request Body:**
```json
{
  "amount": 100.00,
  "description": "Payment for order",
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "254700000000"
  },
  "productId": "product_123",
  "sellerId": "seller_456"
}
```

### Create M-Pesa STK Push
```
POST /api/intasend/mpesa-stk-push
```
Initiates an M-Pesa STK Push payment directly to the customer's phone.

**Request Body:**
```json
{
  "amount": 100.00,
  "description": "Payment for order",
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "phoneNumber": "254700000000",
  "productId": "product_123",
  "sellerId": "seller_456"
}
```

### Payment Callback
```
GET /api/intasend/callback?collection_id=xxx&status=xxx&reference=xxx
```
Handles payment completion callbacks from IntaSend.

### Webhook Handler
```
POST /api/intasend/webhook
```
Receives real-time payment status updates from IntaSend.

### Check Payment Status
```
GET /api/intasend/status/:orderId
```
Retrieves the current status of a payment.

## Database Schema

The integration adds the following columns to the `product_orders` table:

- `intasend_collection_id`: IntaSend payment collection ID
- `intasend_stk_push_id`: IntaSend STK Push ID
- `payment_method`: Extended to include 'intasend' and 'intasend_mpesa'

## Migration from Pesapal

To migrate from Pesapal to IntaSend:

1. **Install Dependencies**: The `intasend-node` package is already included
2. **Run Migration**: Execute the database migration script
3. **Update Environment**: Add IntaSend API credentials
4. **Update Frontend**: Change API endpoints from `/api/pesapal/*` to `/api/intasend/*`
5. **Test Integration**: Use the test endpoints to verify functionality

## Testing

### Sandbox Environment

IntaSend provides a sandbox environment for testing:

- Use sandbox API keys
- Test with sandbox phone numbers
- Verify webhook delivery

### Test Phone Numbers

For M-Pesa STK Push testing, use these sandbox numbers:
- `254700000000` - Success
- `254700000001` - Failure
- `254700000002` - Timeout

## Webhook Configuration

Configure webhooks in your IntaSend dashboard:

1. **Webhook URL**: `https://yourdomain.com/api/intasend/webhook`
2. **Events**: Select payment completion events
3. **Security**: IntaSend will sign webhooks for verification

## Error Handling

The integration includes comprehensive error handling:

- Invalid API credentials
- Network timeouts
- Payment failures
- Webhook signature verification
- Database transaction rollbacks

## Security Considerations

- Webhook signatures are verified
- API keys are stored securely
- Payment data is encrypted in transit
- Database transactions ensure data consistency

## Monitoring and Logging

All IntaSend operations are logged with:

- Payment creation attempts
- Status updates
- Error conditions
- Webhook processing

Check the application logs for detailed information about payment processing.

## Support

For IntaSend-specific issues:

- [IntaSend Documentation](https://developers.intasend.com/docs/introduction)
- [IntaSend Support](https://developers.intasend.com/support)

For application-specific issues, check the application logs and database for detailed error information.
