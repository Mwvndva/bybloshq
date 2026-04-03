import logger from '../utils/logger.js';

/**
 * Middleware to handle double /api prefixes in URLs
 * This ensures that URLs like /api/api/endpoint work the same as /api/endpoint
 */
const fixApiPrefix = (req, res, next) => {
  const originalPath = req.path;

  // Only process if the path starts with /api/api/
  if (originalPath.startsWith('/api/api/')) {
    // Remove the first /api from the path
    const newPath = originalPath.replace(/^\/api/, '');

    // Update the URL
    // C-1: Sanitize path before logging to prevent log injection
    const sanitizedOriginal = originalPath.replace(/[\n\r]/g, '');
    const sanitizedNew = newPath.replace(/[\n\r]/g, '');
    logger.info(`Fixed double API prefix: ${sanitizedOriginal} -> ${sanitizedNew}`);
    req.url = newPath + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '');
  }

  next();
};

export default fixApiPrefix;
