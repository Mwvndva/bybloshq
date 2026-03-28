import winston from 'winston';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a simple console logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  transports: [
    // Console transport - ONLY if NOT in production or if explicitly enabled
    ...(process.env.NODE_ENV !== 'production' ? [new winston.transports.Console()] : []),

    // Simple file transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
  ],
  exitOnError: false, // Don't exit on handled exceptions
});

// Production Silencer: Override global console methods if in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => { };
  console.info = () => { };
  console.debug = () => { };
  // Keep console.error and console.warn for critical issues, but maybe redirect to winston
  console.error = (...args) => logger.error(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  console.warn = (...args) => logger.warn(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
}

// Create a stream object for morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export default logger;
