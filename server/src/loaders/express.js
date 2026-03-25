import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { xss } from 'express-xss-sanitizer';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { doubleCsrf } from 'csrf-csrf';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

import logger from '../utils/logger.js';
import routes from '../routes/index.js';
import { globalErrorHandler, notFoundHandler } from '../utils/errorHandler.js';
import requestId from '../middleware/requestId.js';
import fixApiPrefix from '../middleware/fixApiPrefix.js';

import { doubleCsrfProtection } from '../utils/csrf.js';

export default async (app) => {
    // 1. Basic Setup
    app.set('trust proxy', 1);
    app.use(requestId);
    app.use(helmet());
    app.use(morgan('combined', { stream: logger.stream }));

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
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim().replace(/^["']|["']$/g, ''))
        .filter(o => o !== '');

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

            const isAllowed =
                allowedOrigins.includes(origin) ||
                (isLocal && localOrigins.includes(origin)) ||
                origin.endsWith('.vercel.app');

            if (isAllowed) return callback(null, true);

            logger.warn(`CORS blocked request from origin: ${origin} `);
            return callback(new Error(`Not allowed by CORS: ${origin} `));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
        exposedHeaders: ['Authorization', 'X-Access-Token', 'X-Refresh-Token'],
        maxAge: 86400,
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // 4. CSRF Protection (initialized in src/utils/csrf.js)

    // 5. Rate Limiting & Parsing
    const limiter = rateLimit({
        max: 1000,
        windowMs: 60 * 60 * 1000,
        message: 'Too many requests from this IP, please try again in an hour!',
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use('/api', limiter);
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
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
            req.path.startsWith('/api/whatsapp/') ||
            req.path.includes('/login');
        // Removed /upload-digital exclusion to implement full protection

        if (isExcluded) return next();
        return doubleCsrfProtection(req, res, next);
    });

    // 7. Routes
    app.use(fixApiPrefix);
    app.use('/api', routes);

    // 8. Error Handling
    app.all('*', notFoundHandler);
    app.use(globalErrorHandler);

    return app;
};
