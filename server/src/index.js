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
import * as eventController from './controllers/event.controller.js';
import { pool, testConnection as testDbConnection } from './config/database.js';
import { globalErrorHandler, notFoundHandler } from './utils/errorHandler.js';
import { protect } from './middleware/auth.js';
import requestId from './middleware/requestId.js';
import fixApiPrefix from './middleware/fixApiPrefix.js';
import { schedulePaymentProcessing } from './cron/paymentCron.js';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (prefer server/.env, then repo root .env, then .env.production)
const candidateEnvPaths = [
  path.join(__dirname, '.env'),                 // server/.env (PRIORITY)
  path.join(process.cwd(), '.env'),             // repo root .env
  process.env.NODE_ENV === 'production' ? path.join(__dirname, '.env.production') : null,
].filter(Boolean);

const chosenEnvPath = candidateEnvPaths.find(p => existsSync(p));
dotenv.config({ path: chosenEnvPath });

// Create Express app
const app = express();

// Enable trust proxy to correctly detect client IPs from proxies like Vercel or Cloudflare
app.set('trust proxy', 1);

// Test routes removed

// Add request ID middleware
app.use(requestId);

// Set security HTTP headers
app.use(helmet());

// Use Morgan for logging HTTP requests
app.use(morgan('combined', { stream: logger.stream }));

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api', limiter);

// Serve static files from uploads directory
const uploadsDir = path.join(process.cwd(), 'uploads');
console.log('Serving static files from:', uploadsDir);

// Ensure the uploads directory exists
const ensureUploadsDir = async () => {
  try {
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      console.log('Uploads directory created successfully');
    } else {
      console.log('Uploads directory already exists');
    }
  } catch (error) {
    console.error('Error handling uploads directory:', error);
  }
};

// Serve static files
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    // Set proper cache control for images
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ||
      filePath.endsWith('.png') || filePath.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

ensureUploadsDir();

// CORS configuration - Consolidated configuration
const whitelist = [
  // Development
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:5173',

  // Production domains
  'https://byblosatelier.com',
  'https://www.byblosatelier.com',
  'https://bybloshq.space',
  'https://www.bybloshq.space',
  'https://byblosexperience.vercel.app',
  'https://www.byblosexperience.vercel.app',
  'https://byblos-backend.vercel.app',

  // Development and preview domains
  'https://*.vercel.app',  // All Vercel preview deployments
  'https://*-git-*.vercel.app'  // Vercel branch deployments
];

// Add any additional domains from environment variable
const additionalOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [];

// Consolidated CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        console.log('CORS: Request with no origin - allowing in development');
      }
      return callback(null, true);
    }

    // Check if origin is in whitelist or additionalOrigins
    const isAllowed = whitelist.some(domain => {
      if (domain.includes('*')) {
        const regex = new RegExp('^' + domain.replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return origin === domain;
    }) || additionalOrigins.includes(origin);

    if (isAllowed) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`CORS: Allowed origin: ${origin}`);
      }
      return callback(null, true);
    }

    // Log rejected origins for debugging
    console.warn(`CORS: Blocked origin: ${origin}`);
    console.warn('Allowed origins:', [...whitelist, ...additionalOrigins]);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'X-Requested-With',
    'Accept',
    'X-Access-Token',
    'X-Refresh-Token',
    'X-Request-ID',
    'cache-control',
    'Cache-Control',
    'pragma',
    'Pragma',
    'expires',
    'Expires'
  ],
  exposedHeaders: [
    'Authorization',
    'Content-Length',
    'X-Access-Token',
    'X-Refresh-Token',
    'Content-Range',
    'Content-Disposition',
    'X-Request-ID'
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

// Apply CORS middleware with options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions), (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Allow-Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});
// Increase JSON and URL-encoded payload size limit to 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable cookie parsing
app.use(cookieParser());

// Test database connection
const testConnection = async () => {
  try {
    console.log('Starting database connection test...');
    await testDbConnection();
    console.log('✅ Database connection test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    console.error('Please check your database configuration in .env and ensure the database is running');
    throw error; // Re-throw to be handled by the caller
  }
};

// Add request logging and fix API prefix middleware
// Add detailed request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// Fix double /api prefixes in URLs
app.use(fixApiPrefix);

// Import remaining routes
import eventRoutes from './routes/event.routes.js';
import protectedOrganizerRoutes from './routes/protectedOrganizer.routes.js';
import orderRoutes from './routes/orderRoutes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import refreshTokenRoutes from './routes/refreshToken.routes.js';
import whatsappService from './services/whatsapp.service.js';
import models from './models/index.js';
const { Payment } = models;

// Mount public routes (no authentication required)
// Mount routes
app.use('/api/organizers', organizerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/discount-codes', discountCodeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/auth', refreshTokenRoutes); // Add refresh token route
app.use('/api/callbacks', callbackRoutes); // Webhook callbacks

// Mount protected organizer routes
app.use('/api/organizers', protectedOrganizerRoutes);

// Mount order routes
app.use('/api/orders', orderRoutes);

// Mount WhatsApp routes
app.use('/api/whatsapp', whatsappRoutes);

// Organizer protected routes
const protectedRouter = express.Router();

// Apply protect middleware to all protected routes
protectedRouter.use(protect);

// Mount protected routes
protectedRouter.use('/dashboard', dashboardRoutes);
protectedRouter.use('/tickets', ticketRoutes); // This will be mounted at /api/organizers/tickets

// Mount order routes
app.use('/api', orderRoutes);

// Mount protected event routes under /api/organizers/events
const protectedEventRouter = express.Router();
protectedEventRouter.get('/', eventController.getOrganizerEvents);
protectedEventRouter.post('/', eventController.createEvent);
protectedEventRouter.get('/dashboard', eventController.getDashboardEvents);
protectedEventRouter.get('/:id', eventController.getEvent);
protectedEventRouter.put('/:id', eventController.updateEvent);
protectedEventRouter.delete('/:id', eventController.deleteEvent);
protectedRouter.use('/events', protectedEventRouter);

// Mount protected organizer routes (payouts, etc.)
protectedRouter.use('/', protectedOrganizerRoutes);

// Mount the protected router under /api/organizers
app.use('/api/organizers', protectedRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// 404 handler - must be after all other routes
app.all('*', notFoundHandler);

// Global error handler - must be after all other middleware
app.use(globalErrorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection before starting the server
    await testConnection();

    const port = process.env.PORT || 3002;
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`📡 API available at http://localhost:${port}/api`);

      // Initialize WhatsApp service (non-blocking)
      logger.info('📱 Initializing WhatsApp service...');
      whatsappService.initialize().catch(err => {
        logger.error('⚠️  WhatsApp initialization failed:', err.message);
        logger.info('ℹ️  WhatsApp notifications will be unavailable. Use /api/whatsapp/initialize to retry.');
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please free the port or use a different one.`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Handle process termination
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Shutting down gracefully...');

      try {
        console.log('Closing WhatsApp service...');
        // We use destroy() here instead of logout() to keep session file but release lock
        if (whatsappService.client) {
          await whatsappService.client.destroy();
          console.log('WhatsApp service closed.');
        }
      } catch (err) {
        console.error('Error closing WhatsApp service:', err.message);
      }

      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    // Handle interrupt signal (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log('SIGINT received. Shutting down gracefully...');
      try {
        if (whatsappService.client) {
          await whatsappService.client.destroy();
          console.log('WhatsApp service destroyed.');
        }
      } catch (err) { }
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    process.exit(1);
  }
};

// Start the server and initialize cron jobs
startServer().then(() => {
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
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default app;
