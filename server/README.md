# Byblos Atelier Vogue - Backend API

RESTful API server for the Byblos Atelier Vogue marketplace, built with Node.js, Express, and PostgreSQL. This API powers both the customer-facing e-commerce platform and the seller dashboard.

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

## 🛠 Tech Stack

- **Runtime**: Node.js 18+ with Express
- **Database**: PostgreSQL 13+ with Knex.js
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
git clone https://github.com/yourusername/byblos-atelier-vogue.git
cd byblos-atelier-vogue/server
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
DB_NAME=byblos_atelier
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
# EMAIL_FROM=noreply@byblosatelier.com
```

### 4. Set up the database

1. **Create a new PostgreSQL database**:
   ```sql
   CREATE DATABASE byblos_atelier;
   CREATE USER your_db_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE byblos_atelier TO your_db_user;
   ```

2. **Run migrations**:
   ```bash
   # Install Knex CLI globally (if not already installed)
   npm install -g knex
   
   # Run all pending migrations
   npx knex migrate:latest
   
   # Seed the database with sample data (optional)
   npx knex seed:run
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
npx knex migrate:make migration_name

# Run pending migrations
npx knex migrate:latest

# Rollback last migration
npx knex migrate:rollback

# Run seeds
npx knex seed:run
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
- [Knex.js](https://knexjs.org/) - SQL query builder for Node.js
- [JWT](https://jwt.io/) - JSON Web Tokens for authentication
- [Winston](https://github.com/winstonjs/winston) - Logging library
- [Jest](https://jestjs.io/) - JavaScript Testing Framework
