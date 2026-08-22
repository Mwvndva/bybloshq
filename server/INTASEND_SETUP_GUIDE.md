# IntaSend Integration Setup Guide

## Quick Fix for HTTP 500 Error

The IntaSend integration is failing because the API credentials are not configured. Here's how to fix it:

### Step 1: Get IntaSend API Credentials

1. Go to [IntaSend Developer Portal](https://developers.intasend.com/docs/introduction)
2. Sign up for an account
3. Create a new application
4. Get your **Public Key** and **Secret Key**

### Step 2: Configure Environment Variables

Create a `.env` file in the `server` directory with these variables:

```bash
# IntaSend API Credentials
INTASEND_PUBLIC_KEY=your_actual_public_key_here
INTASEND_SECRET_KEY=your_actual_secret_key_here

# IntaSend Environment (use sandbox for testing)
INTASEND_BASE_URL=https://sandbox.intasend.com

# Other required variables
PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

### Step 3: Test the Configuration

After setting up the credentials, restart the server and test:

```bash
# Test configuration
curl http://localhost:3002/api/intasend/config-test

# Test payment creation
curl -X POST http://localhost:3002/api/intasend/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100",
    "description": "Test payment",
    "sellerId": 1,
    "customer": {
      "id": "1",
      "email": "test@example.com",
      "phone": "254700000000",
      "firstName": "Test",
      "lastName": "User"
    }
  }'
```

### Step 4: Test Phone Numbers (Sandbox)

For M-Pesa STK Push testing, use these sandbox numbers:
- `254700000000` - Success
- `254700000001` - Failure  
- `254700000002` - Timeout

### Troubleshooting

If you still get HTTP 500 errors:

1. **Check credentials**: Make sure the API keys are correct
2. **Check environment**: Ensure you're using sandbox keys for testing
3. **Check logs**: Look at the server logs for detailed error messages
4. **Verify IntaSend account**: Make sure your IntaSend account is active

### Production Setup

For production:
1. Use production API keys from IntaSend
2. Set `INTASEND_BASE_URL=https://api.intasend.com`
3. Configure webhook URLs in IntaSend dashboard
4. Update `PUBLIC_BASE_URL` to your production domain

## Current Status

✅ **Code Issues**: All fixed  
✅ **Validation**: Working correctly  
✅ **API Structure**: Properly formatted  
❌ **Credentials**: Need to be configured  

Once you add the IntaSend API credentials, the payment integration will work perfectly!

