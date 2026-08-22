import { validationResult } from 'express-validator';
import { AppError } from '../utils/errorHandler.js';

/**
 * Middleware to validate request using express-validator
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} _res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    return next(new AppError(`Validation error: ${errorMessages.join('. ')}`, 400));
  }
  
  next();
};

export default validate;
