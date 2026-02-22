// ─── Environment Loading — MUST be first ────────────────────────────────────
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateEnvPaths = [
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env'),
  process.env.NODE_ENV === 'production' ? path.join(__dirname, '.env.production') : null,
].filter(Boolean);

const chosenEnvPath = candidateEnvPaths.find(p => existsSync(p));
dotenv.config({ path: chosenEnvPath });

// ─── Core Imports ────────────────────────────────────────────────────────────
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import xss from 'express-xss-sanitizer';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import logger from './utils/logger.js';
import routes from './routes/index.js';
import { pool, testConnection as testDbConnection } from './config/database.js';
import { globalErrorHandler, notFoundHandler } from './utils/errorHandler.js';
import requestId from './middleware/requestId.js';
import fixApiPrefix from './middleware/fixApiPrefix.js';
import { schedulePaymentProcessing } from './cron/paymentCron.js';
import { schedulePayoutReconciliation } from './cron/payoutCleanup.js';
import whatsappService from './services/whatsapp.service.js';

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();

// Enable trust proxy for Vercel / Cloudflare
app.set('trust proxy', 1);

// Request ID must be first
app.use(requestId);

// Security headers
app.use(helmet());

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// ─── Static Files ────────────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), 'uploads');

const ensureUploadsDir = async () => {
  try {
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      logger.info('Uploads directory created');
    }
  } catch (error) {
    logger.error('Error handling uploads directory:', error);
  }
};

app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    if (/\.(jpg|jpeg|png|webp)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

ensureUploadsDir();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Move additional origins to ALLOWED_ORIGINS env var for production
const whitelist = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:5173',
  'https://byblosatelier.com',
  'https://www.byblosatelier.com',
  'https://bybloshq.space',
  'https://www.bybloshq.space',
  'https://byblosexperience.vercel.app',
  'https://www.byblosexperience.vercel.app',
  'https://byblos-backend.vercel.app',
  'https://*.vercel.app',
  'https://*-git-*.vercel.app',
];

const additionalOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const isAllowed = whitelist.some(domain => {
      if (domain.includes('*')) {
        return new RegExp('^' + domain.replace(/\*/g, '.*') + '$').test(origin);
      }
      return origin === domain;
    }) || additionalOrigins.includes(origin);

    if (isAllowed) return callback(null, true);

    logger.warn('[CORS] Blocked unauthorized origin', { origin });
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Requested-With', 'Accept',
    'Origin', 'X-Access-Token', 'X-Refresh-Token', 'X-Request-ID',
    'Cache-Control', 'Pragma', 'Expires',
  ],
  exposedHeaders: [
    'Authorization', 'Content-Length', 'X-Access-Token', 'X-Refresh-Token',
    'Content-Range', 'Content-Disposition', 'X-Request-ID',
  ],
  maxAge: 86400,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Preflight
app.options('*', cors(corsOptions), (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// ─── Body Parsing & Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Development request logging
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// Fix double /api prefixes
app.use(fixApiPrefix);

// ─── API Routes ───────────────────────────────────────────────────────────────
// All routes are aggregated in src/routes/index.js
app.use('/api', routes);

// ─── Error Handlers (must be last) ───────────────────────────────────────────
app.all('*', notFoundHandler);
app.use(globalErrorHandler);

// ─── Database Connection Test ─────────────────────────────────────────────────
const testConnection = async () => {
  try {
    logger.info('Testing database connection...');
    await testDbConnection();
    logger.info('✅ Database connection test passed');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    throw error;
  }
};

// ─── Inline Debt Feature Migration ───────────────────────────────────────────
// TODO: Move to a dedicated migration runner (e.g. db-migrate, Flyway).
// Migration SQL is at: server/migrations/20260222_add_debt_feature.sql
// This block runs the equivalent logic on startup for safety.
const applyMigrations = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // DEBT_PENDING order status
    const enumCheck = await client.query(
      `SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status') AND enumlabel = 'DEBT_PENDING'`
    );
    if (enumCheck.rowCount === 0) {
      await client.query('COMMIT');
      await client.query("ALTER TYPE order_status ADD VALUE 'DEBT_PENDING'");
      await client.query('BEGIN');
      logger.info("Migration: Added 'DEBT_PENDING' to order_status");
    }

    // is_debt column
    const colCheck = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'product_orders' AND column_name = 'is_debt'`
    );
    if (colCheck.rowCount === 0) {
      await client.query("ALTER TABLE product_orders ADD COLUMN is_debt BOOLEAN DEFAULT FALSE");
      logger.info("Migration: Added 'is_debt' column to product_orders");
    }

    // debt payment method
    const payEnumCheck = await client.query(
      `SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method') AND enumlabel = 'debt'`
    );
    if (payEnumCheck.rowCount === 0) {
      const typeExists = await client.query(`SELECT 1 FROM pg_type WHERE typname = 'payment_method'`);
      if (typeExists.rowCount > 0) {
        await client.query('COMMIT');
        await client.query("ALTER TYPE payment_method ADD VALUE 'debt'");
        await client.query('BEGIN');
        logger.info("Migration: Added 'debt' to payment_method enum");
      }
    }

    // pending_debt payment status
    const payStatusCheck = await client.query(
      `SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status') AND enumlabel = 'pending_debt'`
    );
    if (payStatusCheck.rowCount === 0) {
      const typeExists = await client.query(`SELECT 1 FROM pg_type WHERE typname = 'payment_status'`);
      if (typeExists.rowCount > 0) {
        await client.query('COMMIT');
        await client.query("ALTER TYPE payment_status ADD VALUE 'pending_debt'");
        await client.query('BEGIN');
        logger.info("Migration: Added 'pending_debt' to payment_status enum");
      }
    }

    // client_debts table
    const debtsTableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'client_debts'`
    );
    if (debtsTableCheck.rowCount === 0) {
      await client.query(`
        CREATE TABLE client_debts (
          id SERIAL PRIMARY KEY,
          seller_id INTEGER REFERENCES sellers(id),
          client_id INTEGER REFERENCES clients(id),
          product_id INTEGER REFERENCES products(id),
          amount DECIMAL(10, 2) NOT NULL,
          quantity INTEGER DEFAULT 1,
          is_paid BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      logger.info("Migration: Created 'client_debts' table");
    }

    await client.query('COMMIT');
    logger.info('Migrations applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', err);
  } finally {
    client.release();
  }
};

// ─── Server Start ─────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await testConnection();
    await applyMigrations();

    const port = process.env.PORT || 3002;
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`📡 API available at http://localhost:${port}/api`);
      logger.info('📱 Initializing WhatsApp service...');
      whatsappService.initialize().catch(err => {
        logger.error('⚠️  WhatsApp initialization failed:', err.message);
        logger.info('ℹ️  Use /api/whatsapp/initialize to retry.');
      });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${port} is already in use`);
      } else {
        logger.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      try {
        if (whatsappService.client) {
          await whatsappService.client.destroy();
          logger.info('WhatsApp service closed');
        }
      } catch (err) {
        logger.error('Error closing WhatsApp service:', err.message);
      }
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Failed to start server', {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
    process.exit(1);
  }
};

// ─── Start + Cron Jobs ────────────────────────────────────────────────────────
startServer().then(async () => {
  if (process.env.ENABLE_PAYMENT_CRON !== 'false') {
    try {
      schedulePaymentProcessing({ schedule: '*/5 * * * *', hoursAgo: 24, limit: 50 });
      logger.info('✅ Payment processing cron started');
    } catch (error) {
      logger.error('❌ Failed to start payment cron:', error.message);
    }
  }

  if (process.env.ENABLE_ORDER_DEADLINE_CRON !== 'false') {
    try {
      const { scheduleOrderDeadlineChecks } = await import('./cron/orderDeadlineCron.js');
      scheduleOrderDeadlineChecks({ schedule: '*/30 * * * *' });
      logger.info('✅ Order deadline cron started');
    } catch (error) {
      logger.error('❌ Failed to start order deadline cron:', error.message);
    }
  }

  if (process.env.ENABLE_PAYOUT_RECONCILIATION_CRON !== 'false') {
    try {
      schedulePayoutReconciliation({ schedule: '0 * * * *', hoursAgo: 1 });
      logger.info('✅ Payout reconciliation cron started');
    } catch (error) {
      logger.error('❌ Failed to start payout reconciliation cron:', error.message);
    }
  }
}).catch(error => {
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default app;
