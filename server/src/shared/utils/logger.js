import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const require = createRequire(import.meta.url);
let winston;
let DailyRotateFile;
let logger;

try {
  winston = require('winston');
  DailyRotateFile = require('winston-daily-rotate-file');
} catch (error) {
  const formatMessage = (message, meta) => {
    if (meta.length === 0) return message;
    return `${message} ${meta.map(item => {
      if (item instanceof Error) return item.stack || item.message;
      if (typeof item === 'string') return item;
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    }).join(' ')}`;
  };

  const fallbackLogger = {
    debug: (message, ...meta) => console.debug(formatMessage(message, meta)),
    info: (message, ...meta) => console.info(formatMessage(message, meta)),
    warn: (message, ...meta) => console.warn(formatMessage(message, meta)),
    error: (message, ...meta) => console.error(formatMessage(message, meta)),
    stream: {
      write: (message) => console.info(String(message).trim()),
    },
  };

  console.warn('[LOGGER] winston transports unavailable; using console logger fallback', error.message);
  logger = fallbackLogger;
}

// Create a simple console logger
if (!logger) {
  logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Include stack trace
    winston.format.json() // Production logs should be JSON
  ),
  transports: [
    // Console transport - Always enabled for Docker visibility
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          const stackMessage = stack ? `\n${stack}` : '';
          return `${timestamp} ${level}: ${message}${stackMessage}`;
        })
      )
    }),


    // Daily Rotate File for errors
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
    }),
    // Daily Rotate File for all logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
  exitOnError: false, // Don't exit on handled exceptions
  });
}

// No longer silencing console in production to ensure Docker logs work correctly.


// Create a stream object for morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export default logger;
