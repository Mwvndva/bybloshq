RESTful API server for the BYBLOS marketplace, built with Node.js, Express, and PostgreSQL. This API powers both the customer-facing e-commerce platform and the seller dashboard.

## 🚀 Features

### Payment Processing System

The payment processing system handles the complete lifecycle of payments, from initiation to completion, including automated ticket generation and email notifications.

#### Key Features

- **Webhook Integration**
  - Processes payment status updates from payment providers
  - Handles both successful and failed payments
  - Implements idempotency to prevent duplicate processing

- **Automated Ticket Generation**
  - Creates tickets automatically upon successful payment
  - Generates unique QR codes for each ticket
  - Updates payment records with ticket references

- **Email Notifications**
  - Sends confirmation emails with ticket details
  - Includes QR codes for event access
  - Implements retry logic for failed email deliveries

- **Cron Jobs**
  - Processes pending payments every 5 minutes
  - Retries failed email deliveries
  - Logs all processing attempts for auditing

#### Admin Endpoints

- `POST /api/v1/admin/process-payments` - Manually trigger payment processing
  - Query Parameters:
    - `hours` (optional): Process payments from last X hours (default: 24)
    - `limit` (optional): Maximum number of payments to process (default: 50)

#### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_PAYMENT_CRON` | Enable/disable automatic payment processing | `true` |
| `PAYMENT_WEBHOOK_SECRET` | Secret for verifying webhook signatures | - |
| `EMAIL_FROM_EMAIL` | Sender email for ticket confirmations | - |
| `EMAIL_FROM_NAME` | Sender name for ticket confirmations | - |

#### Monitoring and Logging

- All payment processing activities are logged with detailed context
- Failed payment processing attempts are automatically retried
- Admin dashboard provides visibility into payment processing status

- **Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control
  - Refresh token rotation

- **Product Management**
  - CRUD operations for products
  - Product categorization by aesthetics
  - Image upload and management

- **Order Processing**
  - Shopping cart functionality
  - Order creation and tracking
  - Payment processing integration
  - Automated ticket generation
  - Email notifications with QR codes

- **Seller Management**
  - Seller registration and authentication
  - Product inventory management
  - Sales analytics and reporting

## ⚙️ Process Roles & Background Jobs

This server is a single Express app (`src/index.js`) that can run in one of
two roles, controlled by the `BYBLOS_PROCESS_ROLE` environment variable:

| `BYBLOS_PROCESS_ROLE` | What runs |
|---|---|
| unset, or `all` (**the default**) | API routes **and** every cron job / background worker, all in one process |
| `api` or `web` | API routes only — cron jobs and workers are skipped (`application/bootstrap/index.js`); expected to run separately via `src/worker.js` |

**In production today, `BYBLOS_PROCESS_ROLE` is unset**, so the single
deployed web process (Render service `byblos-backend`) runs both the API
*and* every background job below. There is no separate worker service
actually deployed — `server/render.yaml` describes a two-service split
(`api` role + a dedicated worker service) as a *possible* target
architecture, but that file is not the live Render config for this project's
services (it was written for a differently-named service and never applied
via "New from Blueprint"); it's aspirational, not a description of what's
running. If you're reading only this README and wondering where cron jobs
run: **they run inside the same process as the API**, right now.

This is safe by design at the current scale (see `shouldStartWorkers` in
`application/bootstrap/index.js`), but it means:
- Scaling the web service to more than one instance would start every cron
  job on every instance — set `BYBLOS_PROCESS_ROLE=api` on the web service
  and run `node src/worker.js` as a separate service before doing that.
- A deploy that restarts the process also restarts every cron job's schedule
  (there's no separate worker uptime to rely on).

### Background jobs that start when the worker role is active (`all`, or a dedicated `worker.js` process)

Each is individually toggleable via its own `ENABLE_*_CRON` env var
(default: enabled) — see `application/bootstrap/cron.js`:

- **Payment processing** (`ENABLE_PAYMENT_CRON`) — reconciles pending payments with the provider, every 5 minutes
- **Reconciliation Engine** — self-healing pass over payout/withdrawal state
- **Fulfillment Worker** — processes the order-fulfillment queue
- **Payout reconciliation** (`ENABLE_PAYOUT_RECONCILIATION`)
- **Settlement promotion** (`ENABLE_SETTLEMENT_PROMOTION_CRON`) — promotes Paystack-settled seller earnings into withdrawable balance
- **Order deadline checks** (`ENABLE_ORDER_DEADLINE_CRON`) — custom-production SLA reminders/refunds
- **Cleanup job** (`ENABLE_CLEANUP_CRON`) — daily housekeeping
- **Referral rewards** (`ENABLE_REFERRAL_CRON`) — monthly referral payout

## 🛠 Tech Stack

- **Runtime**: Node.js 18+ with Express
- **Database**: PostgreSQL 13+ with node-pg-migrate
- **Authentication**: JWT with refresh tokens
- **Validation**: Express Validator
- **Logging**: Winston
- **Testing**: Jest & Supertest

## 📋 Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 13+
- npm 9+ or yarn 1.22+
- Git

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/byblos.git
cd byblos/server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=3002
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=byblos
DB_USER=your_db_user
DB_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=generate_a_strong_secret_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Optional: Email configuration
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your_email@example.com
# SMTP_PASS=your_email_password
# EMAIL_FROM=noreply@bybloshq.space
```

### 4. Set up the database

1. **Create a new PostgreSQL database**:
   ```sql
   CREATE DATABASE byblos;
   CREATE USER your_db_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE byblos TO your_db_user;
   ```

2. **Run migrations**:
   ```bash
   # Run all pending migrations
   npm run migrate
   
   # Seed the database with sample data (optional)
   npm run seed
   ```

### 5. Start the server

```bash
# Development mode with hot-reload
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3002/api`

## 📚 API Documentation

### Base URL
All API endpoints are prefixed with `/api`

### Authentication
Most endpoints require authentication. Include the JWT token in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

### Available Endpoints

#### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/logout` - Invalidate refresh token

#### Products
- `GET /products` - List all products (with filtering)
- `GET /products/:id` - Get product details
- `POST /products` - Create new product (seller only)
- `PUT /products/:id` - Update product (seller only)
- `DELETE /products/:id` - Delete product (seller only)

#### Orders
- `GET /orders` - List user's orders
- `GET /orders/:id` - Get order details
- `POST /orders` - Create new order
- `PATCH /orders/:id/status` - Update order status (seller/admin only)

#### Sellers
- `GET /sellers` - List all sellers
- `GET /sellers/:id` - Get seller details
- `GET /sellers/me` - Get current seller profile
- `PATCH /sellers/me` - Update seller profile

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tests/controllers/product.test.js
```

## 🔧 Database Migrations

```bash
# Create new migration file
npm run migrate:create migration_name

# Run pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down

# Run seeds
npm run seed
```

## 🔒 Security Considerations

- Always use HTTPS in production
- Keep your `.env` file secure and never commit it to version control
- Use strong, unique passwords for database users
- Regularly update dependencies to patch security vulnerabilities
- Implement rate limiting for authentication endpoints
- Use CORS to restrict API access to trusted domains

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Fast, unopinionated web framework for Node.js
- [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) - SQL migration tool for Node.js
- [JWT](https://jwt.io/) - JSON Web Tokens for authentication
- [Winston](https://github.com/winstonjs/winston) - Logging library
- [Jest](https://jestjs.io/) - JavaScript Testing Framework
