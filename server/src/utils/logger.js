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
    winston.format.errors({ stack: true }),
    winston.format.splat(), // Enable string interpolation
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...meta } = info;
      
      // Build the log message
      let logMessage = `${timestamp} ${level}: ${message}`;
      
      // Add metadata if present (excluding internal winston properties)
      const metaKeys = Object.keys(meta).filter(key => 
        !['splat', 'Symbol(level)', 'Symbol(message)', 'Symbol(splat)'].includes(key)
      );
      
      if (metaKeys.length > 0) {
        // Stringify the metadata for better readability
        try {
          const metaString = JSON.stringify(meta, null, 2);
          logMessage += `\n${metaString}`;
        } catch (error) {
          // If JSON.stringify fails, try to stringify each property
          const metaParts = metaKeys.map(key => {
            try {
              return `  ${key}: ${JSON.stringify(meta[key], null, 2)}`;
            } catch (e) {
              return `  ${key}: [Unable to serialize]`;
            }
          });
          logMessage += `\n${metaParts.join('\n')}`;
        }
      }
      
      return logMessage;
    })
  ),
  transports: [
    // Console transport
    new winston.transports.Console(),
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

// Create a stream object for morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export default logger;
