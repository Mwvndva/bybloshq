# IntaSend Production Configuration Guide

## Environment Variables for Production

Create a `.env` file in the `server/` directory with the following production configuration:

```env
# Production Environment
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=your_production_db_host
DB_PORT=5432
DB_NAME=your_production_db_name
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password

# IntaSend Production Configuration
INTASEND_BASE_URL=https://payment.intasend.com/api/
INTASEND_PUBLIC_KEY=your_live_intasend_public_key
INTASEND_SECRET_KEY=your_live_intasend_secret_key

# Production URLs (Replace with your actual domain)
PUBLIC_BASE_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com

# WhatsApp Configuration (Production)
WHATSAPP_SESSION_NAME=production_session
WHATSAPP_WEBHOOK_URL=https://yourdomain.com/api/whatsapp/webhook

# Email Configuration (Production)
SMTP_HOST=your_production_smtp_host
SMTP_PORT=587
SMTP_USER=your_production_smtp_user
SMTP_PASS=your_production_smtp_password
FROM_EMAIL=noreply@yourdomain.com

# Security
JWT_SECRET=your_production_jwt_secret_key
ENCRYPTION_KEY=your_production_encryption_key

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Production Checklist

### ✅ IntaSend Integration Ready
- [x] Webhook processing fixed and tested
- [x] Callback handling working correctly
- [x] Order status updates functioning
- [x] WhatsApp notifications integrated
- [x] Payment flow complete (PENDING → DELIVERY_PENDING → DELIVERY_COMPLETE → COMPLETED)

### ✅ Database Schema Ready
- [x] Order statuses updated (DELIVERY_PENDING, DELIVERY_COMPLETE)
- [x] Payment statuses updated (paid)
- [x] Order model integration complete
- [x] Status history tracking working

### ✅ Frontend Integration Ready
- [x] Payment flow working
- [x] Order status display updated
- [x] Confirm receipt functionality working
- [x] Loading states handled correctly

### 🔧 Production Deployment Steps

1. **Environment Setup**
   - Set `NODE_ENV=production`
   - Configure production database
   - Set production IntaSend credentials
   - Update all URLs to production domain

2. **IntaSend Configuration**
   - Use live public/secret keys from IntaSend dashboard
   - Set `INTASEND_BASE_URL=https://payment.intasend.com/api/`
   - Ensure webhook URL is publicly accessible via HTTPS

3. **Security Configuration**
   - Use strong JWT secrets
   - Enable HTTPS for all endpoints
   - Configure CORS for production domain
   - Set up rate limiting

4. **Monitoring & Logging**
   - Configure production logging
   - Set up error monitoring
   - Monitor webhook delivery
   - Track payment success rates

## Key Production Differences

### IntaSend URLs
- **Development**: `https://sandbox.intasend.com`
- **Production**: `https://payment.intasend.com/api/`

### Webhook Requirements
- Must be publicly accessible
- Must use HTTPS
- Must handle IntaSend's webhook format
- Must respond within timeout limits

### Security Considerations
- All URLs must be HTTPS
- Webhook signature verification (when implemented)
- Rate limiting on API endpoints
- Secure credential storage

## Testing Production Setup

1. **Test IntaSend Connection**
   ```bash
   curl -X POST https://yourdomain.com/api/intasend/initialize
   ```

2. **Test Webhook Endpoint**
   ```bash
   curl -X POST https://yourdomain.com/api/intasend/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": "webhook"}'
   ```

3. **Test Payment Flow**
   - Create a test order
   - Process payment through IntaSend
   - Verify webhook receives notification
   - Confirm order status updates

## Support

For production issues:
- Check IntaSend dashboard for transaction status
- Monitor webhook delivery logs
- Verify database order status updates
- Check WhatsApp notification delivery

