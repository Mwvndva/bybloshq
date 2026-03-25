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

  if (process.env.NODE_ENV === 'development') {
    console.error('ERROR 💥', err);

    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // Production error handling
    let error = { ...err };
    // Copy name and message as they might not enumerable
    error.message = err.message;
    error.name = err.name;
    error.stack = err.stack;

    // Handle specific error types
    if (error.code === '23505') error = handlePostgresUniqueError(error);
    if (error.code === '23503') error = handlePostgresForeignKeyError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.code === 'EBADCSRFTOKEN') error.isOperational = true;

    // Operational, trusted error: send message to client
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
      });
    } else {
      // Programming or other unknown error: don't leak error details
      console.error('ERROR 💥', err); // Log original error

      // Send generic message
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
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
  const match = detail.match(/\((.*?)\)=\((.*?)\)/);
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
