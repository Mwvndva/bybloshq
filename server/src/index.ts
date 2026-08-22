// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import express from 'express';
import cors from 'cors';
import organizerRoutes from './routes/organizer.routes.js';
import sellerRoutes from './routes/seller.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import publicRoutes from './routes/public.routes.js';
import healthRoutes from './routes/health.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import eventRoutes from './routes/event.routes.js';
import { pool, testConnection as testDbConnection } from './config/database.js';
import { globalErrorHandler, notFoundHandler } from './utils/errorHandler.js';
import { protect } from './middleware/auth.js';
import adminRoutes from './routes/admin.routes.js'; // Import admin routes

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../.env.production')
  : path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

// Debug log environment variables (without sensitive data)
console.log('Environment variables loaded:');
console.log({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD ? '***' : undefined
});

// Create Express app
const app = express();

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

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://localhost:5173'];
    
    // Allow requests from allowed origins or any localhost/127.0.0.1 in development
    if (
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*') ||
      (process.env.NODE_ENV === 'development' && (
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('0.0.0.0')
      ))
    ) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization', 'Content-Length', 'X-Foo', 'X-Bar'],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

// Middleware
app.use(cors(corsOptions));
// Increase JSON and URL-encoded payload size limit to 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Add cookie parser middleware
import cookieParser from 'cookie-parser';
// @ts-ignore - TypeScript has issues with cookie-parser's default export
app.use(cookieParser());

// Log CORS origin for debugging
console.log('CORS Origin:', process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : 'http://localhost:5173');

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

// Routes - Public routes first to ensure they take precedence
app.use('/api/health', healthRoutes);
app.use('/api', publicRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/admin', adminRoutes); // Mount admin routes

// Mount ticket routes (includes public endpoints)
app.use('/api/tickets', ticketRoutes);

// Mount organizer public routes (login, register, etc.)
app.use('/api/organizers', organizerRoutes);

// Organizer protected routes
const protectedRouter = express.Router();

// Apply protect middleware to all protected routes
protectedRouter.use(protect);

// Mount protected routes
protectedRouter.use('/dashboard', dashboardRoutes);
protectedRouter.use('/tickets', ticketRoutes);
protectedRouter.use('', eventRoutes); // Mount event routes at /api/organizers/events

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
    
    const port = parseInt(process.env.PORT || '3000', 10);
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📡 API available at http://localhost:${port}/api`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
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

startServer();

export default app;
