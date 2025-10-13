# Pesapal V2 Integration Setup Guide

This document outlines the steps required to set up and configure the Pesapal V2 payment integration.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Pesapal V2 Configuration
PESAPAL_CONSUMER_KEY=your_pesapal_consumer_key
PESAPAL_CONSUMER_SECRET=your_pesapal_consumer_secret
PESAPAL_ENV=sandbox  # or 'production' for live environment
PESAPAL_BASE_URL=https://pay.pesapal.com/v3
PESAPAL_IPN_URL=https://yourdomain.com/api/v2/payments/pesapal/ipn
PESAPAL_CALLBACK_URL=https://yourdomain.com/checkout/callback
PESAPAL_CANCELLATION_URL=https://yourdomain.com/checkout/cancelled

# Frontend URLs (for callbacks and redirects)
FRONTEND_URL=https://yourdomain.com

# Platform Commission (9%)
PLATFORM_COMMISSION_RATE=0.09
```

## Database Migration

Run the following command to apply the database schema changes:

```bash
npm run migrate:pesapal-v2
```

This will create the necessary tables for the Pesapal V2 integration, including:
- `product_orders` - Stores order information
- `order_items` - Stores individual items within each order
- `payouts` - Tracks payouts to sellers
- `order_status_history` - Tracks the status history of orders

## API Endpoints

### 1. Initiate Payment

**Endpoint:** `POST /api/v2/payments/pesapal/initiate`

**Request Body:**
```json
{
  "orderId": "ORDER-123",
  "amount": 1000,
  "currency": "KES",
  "description": "Payment for order #123",
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678"
  },
  "billingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "countryCode": "KE",
    "address": "123 Main St",
    "city": "Nairobi",
    "state": "Nairobi",
    "postalCode": "00100"
  },
  "items": [
    {
      "productId": "PROD-123",
      "name": "Product Name",
      "price": 1000,
      "quantity": 1
    }
  ],
  "sellerId": "seller-123"
}
```

### 2. Payment Callback

**Endpoint:** `GET /api/v2/payments/pesapal/callback`

This endpoint handles the callback from Pesapal after payment processing and redirects the user to the appropriate frontend URL.

### 3. IPN (Instant Payment Notification)

**Endpoint:** `POST /api/v2/payments/pesapal/ipn`

This endpoint receives payment status updates from Pesapal. Configure this URL in your Pesapal dashboard.

### 4. Check Payment Status

**Endpoint:** `GET /api/v2/payments/status/:reference`

Check the status of a payment using the order reference.

## Implementation Notes

1. The system calculates a 9% platform commission on each transaction.
2. The remaining 91% is held in escrow until the order is marked as delivered.
3. Sellers can request payouts after the 24-hour holding period.
4. All transactions are logged in the database for reconciliation.

## Testing

1. Use the sandbox environment for testing.
2. Test the complete flow from order creation to payment processing to payout.
3. Verify that all status updates are correctly recorded in the database.

## Troubleshooting

1. **Authentication Errors**: Verify your `PESAPAL_CONSUMER_KEY` and `PESAPAL_CONSUMER_SECRET`.
2. **IPN Notifications**: Ensure your server is accessible from the internet and the IPN URL is correctly configured in Pesapal.
3. **Database Issues**: Check the logs for any database connection or query errors.

## Security Considerations

1. Never commit your `.env` file to version control.
2. Use HTTPS for all endpoints.
3. Validate all incoming requests to the IPN endpoint.
4. Implement rate limiting to prevent abuse.
