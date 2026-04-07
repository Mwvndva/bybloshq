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

  if (process.env.NODE_ENV === 'development') {
    if (err.statusCode === 404) {
      logger.warn(`[Request ID: ${requestId}] 404 Not Found: ${err.message}`);
    } else {
      logger.error(`[Request ID: ${requestId}] ERROR 💥`, err);
    }

    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
      requestId
    });
  } else {
    // Production error handling
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;
    error.stack = err.stack;

    // Handle specific error types
    if (error.code === '23505') error = handlePostgresUniqueError(error);
    if (error.code === '23503') error = handlePostgresForeignKeyError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.code === 'EBADCSRFTOKEN') error.isOperational = true;

    // Log the error with Request ID
    if (error.statusCode === 404) {
      logger.warn(`[Request ID: ${requestId}] 404 Not Found: ${error.message}`);
    } else {
      logger.error(`[Request ID: ${requestId}] ERROR 💥`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode
      });
    }

    // Operational, trusted error: send message to client
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
        requestId
      });
    } else {
      // Programming or other unknown error: don't leak error details
      // Send generic message
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
