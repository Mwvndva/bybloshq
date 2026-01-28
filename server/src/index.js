// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { promises as fs } from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import xss from 'express-xss-sanitizer';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import logger from './utils/logger.js';

// Route Imports
import organizerRoutes from './routes/organizer.routes.js';
import sellerRoutes from './routes/seller.routes.js';
import buyerRoutes from './routes/buyer.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import publicRoutes from './routes/public.routes.js';
import healthRoutes from './routes/health.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import discountCodeRoutes from './routes/discountCode.routes.js';
import adminRoutes from './routes/admin.routes.js';
import refundRoutes from './routes/refund.routes.js';
import callbackRoutes from './routes/callback.routes.js';
import eventRoutes from './routes/event.routes.js';
import protectedOrganizerRoutes from './routes/protectedOrganizer.routes.js';
import orderRoutes from './routes/orderRoutes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import activationRoutes from './routes/activation.routes.js';
import refreshTokenRoutes from './routes/refreshToken.routes.js';

// Controllers & Services
import * as eventController from './controllers/event.controller.js';
import { pool, testConnection as testDbConnection } from './config/database.js';
import { globalErrorHandler, notFoundHandler } from './utils/errorHandler.js';
import { protect } from './middleware/auth.js';
import requestId from './middleware/requestId.js';
import fixApiPrefix from './middleware/fixApiPrefix.js';
import { schedulePaymentProcessing } from './cron/paymentCron.js';
import { schedulePayoutReconciliation } from './cron/payoutCleanup.js';
import whatsappService from './services/whatsapp.service.js';
import models from './models/index.js';

const { Payment } = models;

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const candidateEnvPaths = [
  path.join(__dirname, '.env'),                 // server/.env (PRIORITY)
  path.join(process.cwd(), '.env'),             // repo root .env
  process.env.NODE_ENV === 'production' ? path.join(__dirname, '.env.production') : null,
].filter(Boolean);

const chosenEnvPath = candidateEnvPaths.find(p => existsSync(p));
dotenv.config({ path: chosenEnvPath });

// Create Express app
const app = express();

// Enable trust proxy
app.set('trust proxy', 1);

// --- Middleware Stack (Ordered) ---

// 1. Fix API Prefix (Should be first to normalize info)
app.use(fixApiPrefix);

// 2. Request ID (Traceability)
app.use(requestId);

// 3. Security Headers (Helmet)
app.use(helmet());

// 4. Logging (Morgan)
app.use(morgan('combined', { stream: logger.stream }));

// 5. Rate Limiting
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: true,
  legacyHeaders: false,
});

// 6. CORS
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
  'https://*-git-*.vercel.app'
];

const additionalOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        // console.log('CORS: Request with no origin - allowing in development');
      }
      return callback(null, true);
    }

    const isAllowed = whitelist.some(domain => {
      if (domain.includes('*')) {
        const regex = new RegExp('^' + domain.replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return origin === domain;
    }) || additionalOrigins.includes(origin);

    if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`CORS: Blocked origin: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin',
    'Access-Control-Allow-Origin', 'X-Access-Token', 'X-Refresh-Token',
    'X-Request-ID', 'cache-control', 'Cache-Control', 'pragma', 'Pragma',
    'expires', 'Expires'
  ],
  exposedHeaders: [
    'Authorization', 'Content-Length', 'X-Access-Token', 'X-Refresh-Token',
    'Content-Range', 'Content-Disposition', 'X-Request-ID'
  ],
  maxAge: 86400,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 7. Rate Limit API routes
app.use('/api', limiter);

// 8. Body Parsing & Cookie Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// 9. Static Files
const uploadsDir = path.join(process.cwd(), 'uploads');
const ensureUploadsDir = async () => {
  try {
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      console.log('Uploads directory created successfully');
    }
  } catch (error) {
    console.error('Error handling uploads directory:', error);
  }
};
ensureUploadsDir();

app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.(jpg|jpeg|png|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// 10. Development Logging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// --- Routes ---

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Primary Routes
app.use('/api/auth', refreshTokenRoutes);
app.use('/api/organizers', organizerRoutes); // Public (login/register) + some mixed
app.use('/api/sellers', sellerRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/dashboard', dashboardRoutes); // Generic dashboard?
app.use('/api/public', publicRoutes); // Public event listings?
app.use('/api/tickets', ticketRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/discount-codes', discountCodeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/events', eventRoutes); // Main events API
app.use('/api/orders', orderRoutes); // Deduplicated mount
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/activation', activationRoutes);
app.use('/api/callbacks', callbackRoutes);

// --- Organizer Custom Protected Router ---
// This section aggregates routes specific to the authenticated organizer context
// e.g., "My Dashboard", "My Events", "My Payouts"
const organizerPortalRouter = express.Router();

organizerPortalRouter.use(protect); // Enforce auth

// Sub-routes for the portal
organizerPortalRouter.use('/dashboard', dashboardRoutes);
organizerPortalRouter.use('/tickets', ticketRoutes); // Alias for /api/tickets but maybe different context?
organizerPortalRouter.use('/', protectedOrganizerRoutes); // Payouts etc.

// Inline Organizer Events Logic (Legacy/Specific binding)
const protectedEventRouter = express.Router();
protectedEventRouter.get('/', eventController.getOrganizerEvents);
protectedEventRouter.post('/', eventController.createEvent);
protectedEventRouter.get('/dashboard', eventController.getDashboardEvents);
protectedEventRouter.get('/:id', eventController.getEvent);
protectedEventRouter.put('/:id', eventController.updateEvent);
protectedEventRouter.delete('/:id', eventController.deleteEvent);
organizerPortalRouter.use('/events', protectedEventRouter);

// Mount the portal router
// Note: This creates /api/organizers/dashboard, /api/organizers/events etc.
// It overlaps with /api/organizers from organizerRoutes, but express handles this by matching specific paths first.
// Ensure organizerRoutes doesn't consume these paths wildly.
app.use('/api/organizers', organizerPortalRouter);


// --- Error Handling ---

app.all('*', notFoundHandler);
app.use(globalErrorHandler);

// --- Server Startup ---

const startServer = async () => {
  try {
    await testConnection();

    const port = process.env.PORT || 3002;
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`📡 API available at http://localhost:${port}/api`);

      // Initialize WhatsApp (Non-blocking)
      whatsappService.initialize().catch(err => {
        logger.error('⚠️  WhatsApp initialization failed:', err.message);
      });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use.`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down gracefully...`);
      try {
        if (whatsappService.client) {
          await whatsappService.client.destroy();
        }
      } catch (err) { }
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Test database connection helper
const testConnection = async () => {
  try {
    console.log('Starting database connection test...');
    await testDbConnection();
    console.log('✅ Database connection test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', {
      message: error.message,
      code: error.code
    });
    throw error;
  }
};

// Start the server and initialize cron jobs
startServer().then(async () => {
  // Start the payment processing cron job when server starts
  if (process.env.ENABLE_PAYMENT_CRON !== 'false') {
    console.log('🚀 Starting payment processing cron job...');
    try {
      schedulePaymentProcessing({
        schedule: '*/5 * * * *', // Every 5 minutes
        hoursAgo: 24, // Process payments from the last 24 hours
        limit: 50 // Process up to 50 payments per run
      });
      console.log('✅ Payment processing cron job started successfully');
    } catch (error) {
      console.error('❌ Failed to start payment processing cron job:', error.message);
    }
  } else {
    console.log('ℹ️  Payment processing cron job is disabled (ENABLE_PAYMENT_CRON=false)');
  }

  // Start the order deadline cron job
  if (process.env.ENABLE_ORDER_DEADLINE_CRON !== 'false') {
    console.log('🚀 Starting order deadline cron job...');
    try {
      const { scheduleOrderDeadlineChecks } = await import('./cron/orderDeadlineCron.js');
      scheduleOrderDeadlineChecks({
        schedule: '*/30 * * * *' // Every 30 minutes
      });
      console.log('✅ Order deadline cron job started successfully');
    } catch (error) {
      console.error('❌ Failed to start order deadline cron job:', error.message);
    }
  } else {
    console.log('ℹ️  Order deadline cron job is disabled (ENABLE_ORDER_DEADLINE_CRON=false)');
  }

  // Start the payout reconciliation cron job
  if (process.env.ENABLE_PAYOUT_RECONCILIATION_CRON !== 'false') {
    console.log('🚀 Starting payout reconciliation cron job...');
    try {
      schedulePayoutReconciliation({
        schedule: '0 * * * *', // Every hour
        hoursAgo: 1
      });
      console.log('✅ Payout reconciliation cron job started successfully');
    } catch (error) {
      console.error('❌ Failed to start payout reconciliation cron job:', error.message);
    }
  } else {
    console.log('ℹ️  Payout reconciliation cron job is disabled (ENABLE_PAYMENT_CRON=false)');
  }
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default app;
