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
    const whitelist = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
        'http://localhost:5173',
        'https://bybloshq.space',
        'https://www.bybloshq.space',
        'https://byblosexperience.vercel.app',
    ];

    const additionalOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];

    const corsOptions = {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            const isAllowed = whitelist.includes(origin) ||
                additionalOrigins.includes(origin) ||
                origin.endsWith('.vercel.app');

            if (isAllowed) return callback(null, true);
            return callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
        exposedHeaders: ['Authorization', 'X-Access-Token', 'X-Refresh-Token'],
        maxAge: 86400,
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // 4. CSRF Protection
    const { doubleCsrfProtection } = doubleCsrf({
        getSecret: () => process.env.CSRF_SECRET,
        getSessionIdentifier: (req) => req.ip || 'anonymous',
        cookieName: 'x-csrf-token',
        cookieOptions: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
        },
        size: 64,
        ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
        getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
    });

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
        const isExcluded =
            req.path.startsWith('/api/payments/webhook') ||
            req.path.startsWith('/api/callbacks/') ||
            req.path.startsWith('/api/whatsapp/') ||
            req.path.includes('/login');

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
