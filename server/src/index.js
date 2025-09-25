// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { xss } from 'express-xss-sanitizer';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import organizerRoutes from './routes/organizer.routes.js';
import sellerRoutes from './routes/seller.routes.js';
import buyerRoutes from './routes/buyer.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import publicRoutes from './routes/public.routes.js';
import healthRoutes from './routes/health.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import pesapalRoutes from './routes/pesapal.routes.js';
import adminRoutes from './routes/admin.routes.js';
import sellerOrderRoutes from './routes/sellerOrderRoutes.js';
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
  path.resolve(__dirname, '../.env'),                 // server/.env
  path.resolve(__dirname, '../../.env'),              // repo root .env
  process.env.NODE_ENV === 'production' ? path.resolve(__dirname, '../.env.production') : null,
].filter(Boolean);

const chosenEnvPath = candidateEnvPaths.find(p => existsSync(p));
dotenv.config({ path: chosenEnvPath });

// Debug log environment variables (without sensitive data)
console.log('Environment variables loaded:');
console.log({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD ? '***' : undefined,
  ENV_PATH: chosenEnvPath
});

// Create Express app
const app = express();

// Mount test routes first - completely public
import testRoutes from './controllers/test.controller.js';
import testOrderRoutes from './routes/test.routes.js';

app.use('/test', testRoutes);
app.use('/api/test', testOrderRoutes);

// Add request ID middleware
app.use(requestId);

// Set security HTTP headers
app.use(helmet());

// CORS configuration is now consolidated below

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} [${req.id}]`);
  next();
});

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
  keyGenerator: (req) => {
    // Use both IP and request ID for rate limiting
    return `${req.ip}:${req.id}`;
  }
});

app.use('/api', limiter);

// Serve static files from uploads directory
const uploadsDir = path.join(process.cwd(), 'uploads');
console.log('Serving static files from:', uploadsDir);

// Ensure the uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await mkdir(uploadsDir, { recursive: true });
    console.log('Uploads directory is ready');
  } catch (error) {
    console.error('Error creating uploads directory:', error);
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

// Log CORS configuration
console.log('CORS Configuration:', {
  whitelist: [...whitelist, ...additionalOrigins],
  environment: process.env.NODE_ENV || 'development'
});
// Increase JSON and URL-encoded payload size limit to 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cookie parser is already imported and used above

// Log CORS configuration for debugging
console.log('CORS Configuration:', {
  whitelist,
  additionalOrigins,
  nodeEnv: process.env.NODE_ENV || 'development'
});

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
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Fix double /api prefixes in URLs
app.use(fixApiPrefix);

// Import remaining routes
import eventRoutes from './routes/event.routes.js';
import protectedOrganizerRoutes from './routes/protectedOrganizer.routes.js';
import orderRoutes from './routes/orderRoutes.js';
import models from './models/index.js';
const { Payment } = models;

// Mount public routes (no authentication required)
app.use('/api/organizers', organizerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/sellers/orders', sellerOrderRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/payments', paymentRoutes);
// Mount Pesapal routes
app.use('/api/pesapal', pesapalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/orders', orderRoutes);

// Debug: Log all registered routes in development
if (process.env.NODE_ENV === 'development') {
  console.log('\n=== Registered Routes ===');
  
  // Simple route printing function
  const printRoutes = (router, prefix = '') => {
    if (!router || !router.stack) return;
    
    router.stack.forEach(layer => {
      if (layer.route) {
        // Routes registered directly on the app
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        console.log(`${methods.padEnd(7)} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle) {
        // Nested router - just print the routes without the prefix for now
        printRoutes(layer.handle, '');
      }
    });
  };
  
  // Print all routes
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      // Direct routes
      const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
      console.log(`${methods.padEnd(7)} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle) {
      // Router middleware - print the routes
      printRoutes(middleware.handle, '');
    }
  });
  
  // Manually log the Pesapal routes we expect
  console.log('\n=== Expected Pesapal Routes ===');
  console.log('POST    /api/pesapal/initialize');
  console.log('POST    /api/pesapal/checkout');
  console.log('GET     /api/pesapal/callback');
  console.log('POST    /api/pesapal/ipn');
  console.log('GET     /api/pesapal/status/:orderId');
  console.log('GET     /api/pesapal/test');
}

// Organizer protected routes
const protectedRouter = express.Router();

// Apply protect middleware to all protected routes
protectedRouter.use(protect);

// Mount protected routes
protectedRouter.use('/dashboard', dashboardRoutes);
protectedRouter.use('/tickets', ticketRoutes); // This will be mounted at /api/organizers/tickets

// Mount order routes
app.use('/api', orderRoutes);

// Mount protected organizer routes (payouts, etc.)
protectedRouter.use('/', protectedOrganizerRoutes);

// Mount protected event routes under /api/organizers/events
const protectedEventRouter = express.Router();
protectedEventRouter.get('/', eventController.getOrganizerEvents);
protectedEventRouter.post('/', eventController.createEvent);
protectedEventRouter.get('/dashboard', eventController.getDashboardEvents);
protectedEventRouter.get('/:id', eventController.getEvent);
protectedEventRouter.delete('/:id', eventController.deleteEvent);
protectedRouter.use('/events', protectedEventRouter);

// Mount the protected router under /api/organizers
app.use('/api/organizers', protectedRouter);

// Log all registered routes for debugging
const printRoutes = (router, prefix = '') => {
  // Skip if router or router.stack is undefined
  if (!router || !router.stack) {
    console.log('No routes to display - router or router.stack is undefined');
    return;
  }

  router.stack.forEach((middleware) => {
    if (!middleware) return;
    
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = middleware.route.methods ? 
        Object.keys(middleware.route.methods).join(',').toUpperCase() : 'ALL';
      console.log(`${methods.padEnd(7)} ${prefix}${middleware.route.path || ''}`);
    } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
      // Router middleware
      let path = '';
      if (middleware.regexp) {
        path = middleware.regexp.toString()
          .replace(/^\^\\\//, '')  // Remove leading ^\/
          .replace(/\\\/\?/g, '')  // Remove escaped /?
          .replace(/\(\?=[^)]*\$\//, '') // Remove lookahead groups
          .replace(/\(([^)]+)\)/g, ':$1'); // Convert (param) to :param
      }
      
      middleware.handle.stack.forEach((handler) => {
        if (handler && handler.route) {
          const methods = handler.route.methods ? 
            Object.keys(handler.route.methods).join(',').toUpperCase() : 'ALL';
          console.log(`${methods.padEnd(7)} ${prefix}${path}${handler.route.path || ''}`);
        }
      });
    }
  });
};

// Log all routes when in development
if (process.env.NODE_ENV === 'development') {
  console.log('\n=== Registered Routes ===');
  printRoutes(app, '/api');
  console.log('========================\n');
}

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
    
    const port = process.env.PORT || 3000;
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📡 API available at http://localhost:${port}/api`);
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
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
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
