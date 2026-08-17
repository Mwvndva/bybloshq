import logger from './logger.js';

// Custom error class for application errors
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handling middleware
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  const requestId = req.id || req.headers['x-request-id'] || 'N/A';

  // Normalize/clone error properties
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.stack = err.stack;
  error.isOperational = err.isOperational;

  // Handle specific error types
  if (error.code === '23505') error = handlePostgresUniqueError(error);
  if (error.code === '23503') error = handlePostgresForeignKeyError(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (error.code === 'EBADCSRFTOKEN') error.isOperational = true;

  // Handle PayloadTooLargeError / entity.too.large
  if (
    error.name === 'PayloadTooLargeError' ||
    err.type === 'entity.too.large' ||
    error.statusCode === 413 ||
    err.statusCode === 413
  ) {
    error.isOperational = true;
    error.statusCode = 413;
    error.message = 'Image size is too large. The maximum file size allowed is 10MB.';
  }

  // Handle Multer errors
  if (error.code?.startsWith('LIMIT_')) {
    error.isOperational = true;
    error.statusCode = 400;
    if (error.code === 'LIMIT_FILE_SIZE') {
      error.message = 'File is too large. Max size is 500MB.';
    }
  }

  // Ensure status maps correctly (4xx should be 'fail', 5xx should be 'error')
  error.status = `${error.statusCode}`.startsWith('4') ? 'fail' : 'error';

  // Log the error
  if (error.statusCode === 404) {
    logger.warn(`[Request ID: ${requestId}] 404 Not Found: ${error.message}`);
  } else if (error.statusCode === 413) {
    logger.warn(`[Request ID: ${requestId}] Image Size Too Large: ${error.message}`);
  } else if (error.isOperational) {
    logger.warn(`[Request ID: ${requestId}] Operational ${error.statusCode}: ${error.message}`);
  } else {
    // Non-operational or database/programming error: log as error with stack trace
    if (process.env.NODE_ENV === 'development') {
      logger.error(`[Request ID: ${requestId}] ERROR 💥`, err);
    } else {
      logger.error(`[Request ID: ${requestId}] ERROR 💥`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode
      });
    }
  }

  // Send response based on environment
  if (process.env.NODE_ENV === 'development') {
    res.status(error.statusCode).json({
      status: error.status,
      error: err,
      message: error.message,
      stack: error.stack,
      requestId
    });
  } else {
    // Production response
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
        requestId
      });
    } else {
      // Programming or other unknown error: don't leak error details
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
        requestId
      });
    }
  }
};

// Handle 404 errors
export const notFoundHandler = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};

// Handle JWT errors
export const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again!', 401);
};

export const handleJWTExpiredError = () => {
  return new AppError('Your token has expired! Please log in again.', 401);
};

// Handle PostgreSQL Unique Violation (23505)
export const handlePostgresUniqueError = (err) => {
  const detail = err.detail || '';
  // C-1: Use a safer regex to prevent ReDoS by explicitly excluding parentheses
  const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
  const message = match
    ? `Duplicate value for ${match[1]}: ${match[2]}. Please use another value!`
    : 'Duplicate field value. Please use another value!';
  return new AppError(message, 400);
};

// Handle PostgreSQL Foreign Key Violation (23503)
export const handlePostgresForeignKeyError = (err) => {
  const detail = err.detail || '';
  const message = `Invalid reference: ${detail}. This operation violates a database relationship.`;
  return new AppError(message, 400);
};
