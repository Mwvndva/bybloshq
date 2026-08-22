import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { xss } from 'express-xss-sanitizer';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { mkdir } from 'fs/promises';

import logger from '../../shared/utils/logger.js';
import routes from '../routes/index.js';
import seoRoutes from '../routes/seo.routes.js';
import { handleSocialCrawlerSeo } from '../middleware/socialCrawlerSeo.js';
import { globalErrorHandler, notFoundHandler } from '../../shared/utils/errorHandler.js';
import requestId from '../middleware/requestId.js';
import fixApiPrefix from '../middleware/fixApiPrefix.js';
import { globalLimiter } from '../middleware/globalRateLimiter.js';


export default async (app) => {
    // 1. Basic Setup
    app.set('trust proxy', 1);
    app.use(requestId);
    app.use(compression());
    const morganFormat = process.env.NODE_ENV === 'production' ? 'short' : 'combined';
    app.use(morgan(morganFormat, { stream: logger.stream }));

    // 2. Static Files & Uploads Dir
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    app.use('/uploads', express.static(uploadsDir, {
        setHeaders: (res, filePath) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (/\.(html?|svg|xml|js|mjs|css)$/i.test(filePath)) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            }
            if (/\.(jpg|jpeg|png|webp)$/.test(filePath)) {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        }
    }));

    // 3. CORS Hardening with Pre-Calculated Origin Set
    const buildOriginSet = (rawList) => {
        const set = new Set();
        for (const item of rawList) {
            if (!item) continue;
            const trimmed = String(item).trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
            if (!trimmed) continue;
            set.add(trimmed);
            try {
                const url = new URL(trimmed);
                const host = url.hostname;
                const port = url.port ? `:${url.port}` : '';
                if (host.startsWith('www.')) {
                    set.add(`${url.protocol}//${host.substring(4)}${port}`);
                } else {
                    set.add(`${url.protocol}//www.${host}${port}`);
                }
            } catch {
                // Ignore non-URL origin strings
            }
        }
        return set;
    };

    const isLocal = process.env.NODE_ENV !== 'production';
    const allowedOriginSet = buildOriginSet([
        ...(process.env.ALLOWED_ORIGINS || '').split(','),
        process.env.FRONTEND_URL,
        'capacitor://localhost',
        'ionic://localhost',
        'https://localhost',
        ...(isLocal ? [
            'http://localhost:3000', 'http://127.0.0.1:3000',
            'http://localhost:3001', 'http://127.0.0.1:3001',
            'http://localhost:3002', 'http://127.0.0.1:3002',
            'http://localhost:5173', 'http://127.0.0.1:5173'
        ] : [])
    ]);

    logger.info(`🌐 Whitelisted origins count: ${allowedOriginSet.size}`);

    const corsOptions = {
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);

            if (allowedOriginSet.has(origin)) return callback(null, true);

            logger.warn(`CORS blocked request from origin: ${origin}`);
            // Return 403 instead of 500 by marking error as operational
            const error = new Error(`Not allowed by CORS: ${origin}`);
            error.statusCode = 403;
            error.isOperational = true;
            return callback(error);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-CSRF-Token',
            'Idempotency-Key',
            'X-Checkout-Token',
            'X-Idempotency-Key',
            'X-Request-Id',
            'Cache-Control',
            'Pragma',
            'Expires'
        ],
        exposedHeaders: ['Authorization', 'X-Access-Token', 'X-Refresh-Token', 'X-Request-Id'],
        maxAge: 86400,
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // Helmet CSP for API responses. The real frontend CSP lives in
    // nginx/production.nginx.conf; this layer is defense-in-depth and
    // does not need 'unsafe-inline' since JSON responses contain no
    // executable inline script.
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
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
    // Global limiter shares one Redis counter across horizontally-scaled
    // instances (fail-open). See middleware/globalRateLimiter.js.
    app.use('/api', globalLimiter);
    // Enable JSON body parsing with raw body capture for HMAC verification.
    // Large binary uploads must use upload endpoints, not base64 JSON bodies.
    app.use(express.json({
        limit: process.env.JSON_BODY_LIMIT || '2mb',
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    }));

    // Dedicated Body Parser Error Catching Middleware
    app.use((err, req, res, next) => {
        if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid JSON payload syntax.'
            });
        }
        if (err.type === 'entity.too.large') {
            return res.status(413).json({
                status: 'error',
                message: 'Request payload exceeds maximum allowed size (2MB).'
            });
        }
        next(err);
    });

    app.use(express.urlencoded({ extended: true, limit: process.env.FORM_BODY_LIMIT || '2mb' }));
    app.use(cookieParser());
    app.use(xss());
    app.use(hpp());

    // 6. CSRF Middleware with exclusions
    app.use((req, res, next) => {
        // CSRF DEBUG LOGGING (Root Cause 6)
        if (req.method === 'POST') {
            logger.debug(`[CSRF-DEBUG] POST ${req.path} | cookie: ${!!req.cookies['csrf-token-v2']} | header: ${!!req.headers['x-csrf-token']}`);
        }

        // Ensure a CSRF session ID exists for non-GET requests if use SessionID as identifier
        if (!req.cookies['csrf-session-id'] && req.method !== 'GET') {
            // This will be set by the /csrf-token route, but we add a safety check
        }

        const isExcluded =
            req.path.startsWith('/api/payments/webhook') ||
            req.path.startsWith('/api/callbacks/') ||
            req.path.startsWith('/api/webhooks/');

        if (isExcluded) return next();

        // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
        // This allows fetching the token and initial page loads
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

        // Native mobile apps (Capacitor/Cordova) operate in a sandboxed WebView
        // container (https://localhost / capacitor://localhost) and authenticate via
        // explicit Bearer tokens in device storage, making them immune to browser
        // ambient-credential CSRF attacks.
        const origin = req.headers.origin;

        // Known browser origins must NOT bypass CSRF protection even if they supply a Bearer header.
        const isBrowserWebOrigin = origin && (
            origin.includes('localhost:3000') ||
            origin.includes('localhost:5173') ||
            origin.includes('127.0.0.1:3000') ||
            origin.includes('127.0.0.1:5173') ||
            (origin.startsWith('http://') && !origin.includes('http://localhost:0')) ||
            (origin.startsWith('https://') && origin !== 'https://localhost')
        );

        const isNativeOrigin = origin && (
            origin === 'https://localhost' ||
            origin === 'capacitor://localhost' ||
            origin === 'ionic://localhost'
        );

        const isNativePlatformHeader = req.headers['x-platform'] === 'android';

        // Legitimate native Android requests operate in Capacitor WebView (https://localhost)
        // or supply x-platform: android header when NOT from a browser web origin.
        const isLegitimateNativeRequest = isNativeOrigin || (isNativePlatformHeader && !isBrowserWebOrigin);

        if (isLegitimateNativeRequest) {
            return next();
        }

        // Simple Double Submit Cookie Check (for standard web browser sessions)
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

    // Root health check endpoints for cloud monitoring and keep-alive (UptimeRobot, Render, Kubernetes)
    app.get(['/health', '/api/health', '/ping'], async (req, res) => {
        try {
            res.status(200).json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        } catch {
            res.status(200).send('OK');
        }
    });

    app.get(['/health/readiness', '/api/health/readiness'], async (req, res) => {
        try {
            const { pool } = await import('../../infrastructure/database/database.js');
            await pool.query('SELECT 1');
            res.status(200).json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
        } catch (error) {
            res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
        }
    });

    app.get('/', (req, res) => {
        res.status(200).json({ status: 'ok', message: 'Byblos API is operational' });
    });

    // 7. Routes
    app.use(handleSocialCrawlerSeo);
    app.use('/', seoRoutes);
    app.use(fixApiPrefix);
    app.use('/api', routes);

    // 8. Error Handling
    app.all('*', notFoundHandler);
    app.use(globalErrorHandler);

    return app;
};


