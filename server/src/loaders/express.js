import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { xss } from 'express-xss-sanitizer';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

import logger from '../utils/logger.js';
import routes from '../routes/index.js';
import { globalErrorHandler, notFoundHandler } from '../utils/errorHandler.js';
import requestId from '../middleware/requestId.js';
import fixApiPrefix from '../middleware/fixApiPrefix.js';


export default async (app) => {
    // 1. Basic Setup
    app.set('trust proxy', 1);
    app.use(requestId);
    app.use(compression());
    const morganFormat = process.env.NODE_ENV === 'production' ? 'short' : 'combined';
    app.use(morgan(morganFormat, { stream: logger.stream }));

    // 2. Static Files & Uploads Dir
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
        logger.info('Uploads directory created');
    }
    app.use('/uploads', express.static(uploadsDir, {
        setHeaders: (res, filePath) => {
            if (/\.(jpg|jpeg|png|webp)$/.test(filePath)) {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        }
    }));

    // 3. CORS Hardening
    const rawAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim().replace(/^["']|["']$/g, ''))
        .filter(o => o !== '');

    // Automatically include FRONTEND_URL if set
    if (process.env.FRONTEND_URL) {
        rawAllowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
    }

    const allowedOrigins = [...new Set(rawAllowedOrigins)];
    logger.info(`🌐 Whitelisted origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'none (using defaults)'}`);

    const isLocal = process.env.NODE_ENV !== 'production';
    const localOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ];

    const corsOptions = {
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);

            // Dynamic check for allowed origins including www/non-www variants
            const checkOrigin = (allowedList, currentOrigin) => {
                if (allowedList.includes(currentOrigin)) return true;

                // Check if adding/removing 'www.' makes it match
                const url = new URL(currentOrigin);
                const hostname = url.hostname;
                const protocol = url.protocol;
                const port = url.port ? `:${url.port}` : '';

                if (hostname.startsWith('www.')) {
                    const nonWwwOrigin = `${protocol}//${hostname.substring(4)}${port}`;
                    if (allowedList.includes(nonWwwOrigin)) return true;
                } else {
                    const wwwOrigin = `${protocol}//www.${hostname}${port}`;
                    if (allowedList.includes(wwwOrigin)) return true;
                }
                return false;
            };

            const isAllowed =
                checkOrigin(allowedOrigins, origin) ||
                (isLocal && checkOrigin(localOrigins, origin));

            if (isAllowed) return callback(null, true);

            logger.warn(`CORS blocked request from origin: ${origin}`);
            // Return 403 instead of 500 by marking error as operational
            const error = new Error(`Not allowed by CORS: ${origin}`);
            error.statusCode = 403;
            error.isOperational = true;
            return callback(error);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
        exposedHeaders: ['Authorization', 'X-Access-Token', 'X-Refresh-Token'],
        maxAge: 86400,
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // Update Helmet for CSP
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://wa.me", "https://*.whatsapp.net"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    connectSrc: ["'self'"],
                },
            },
        })
    );

    // 4. CSRF Protection (initialized in src/utils/csrf.js)

    // 5. Rate Limiting & Parsing
    const limiter = rateLimit({
        max: 5000,
        windowMs: 60 * 60 * 1000,
        message: 'Too many requests from this IP, please try again in an hour!',
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use('/api', limiter);
    // Enable JSON body parsing with higher limits for base64 images
    app.use(express.json({ limit: '500mb' }));
    app.use(express.urlencoded({ extended: true, limit: '500mb' }));
    app.use(cookieParser());
    app.use(xss());
    app.use(hpp());

    // 6. CSRF Middleware with exclusions
    app.use((req, res, next) => {
        // Ensure a CSRF session ID exists for non-GET requests if use SessionID as identifier
        if (!req.cookies['csrf-session-id'] && req.method !== 'GET') {
            // This will be set by the /csrf-token route, but we add a safety check
        }

        const isExcluded =
            req.path.startsWith('/api/payments/webhook') ||
            req.path.startsWith('/api/callbacks/') ||
            req.path.startsWith('/api/whatsapp/');

        if (isExcluded) return next();

        // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
        // This allows fetching the token and initial page loads
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

        // Simple Double Submit Cookie Check
        const cookieToken = req.cookies['csrf-token-v2'];
        const headerToken = req.headers['x-csrf-token'];

        if (cookieToken && headerToken && cookieToken === headerToken) {
            return next();
        }

        logger.warn(`CSRF failed: ${req.method} ${req.path} - Cookie: ${!!cookieToken}, Header: ${!!headerToken}`);
        return res.status(403).json({
            status: 'error',
            message: 'Security validation failed (CSRF mismatch). Please refresh the page.'
        });
    });

    // 7. Routes
    app.use(fixApiPrefix);
    app.use('/api', routes);

    // 8. Error Handling
    app.all('*', notFoundHandler);
    app.use(globalErrorHandler);

    return app;
};
