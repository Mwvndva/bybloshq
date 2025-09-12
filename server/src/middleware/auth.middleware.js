import jwt from 'jsonwebtoken';
import AppError from '../utils/appError.js';
import Buyer from '../models/buyer.model.js';

// Protect routes - user must be authenticated
export const protect = (roles = []) => {
  return async (req, res, next) => {
    try {
      let token;
      
      // 1) Get token and check if it exists
      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
      ) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.cookies?.jwt) {
        token = req.cookies.jwt;
      }

      if (!token) {
        return next(
          new AppError('You are not logged in! Please log in to get access.', 401)
        );
      }

      // 2) Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3) Check if user still exists
      const currentUser = await Buyer.findById(decoded.id);
      if (!currentUser) {
        return next(
          new AppError('The user belonging to this token no longer exists.', 401)
        );
      }

      // 4) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(
          new AppError('User recently changed password! Please log in again.', 401)
        );
      }

      // 5) Check if user has the required role
      if (roles.length && !roles.includes(decoded.role)) {
        return next(
          new AppError('You do not have permission to perform this action', 403)
        );
      }

      // 6) Grant access to protected route
      req.user = {
        id: currentUser.id,
        role: decoded.role
      };
      res.locals.user = currentUser;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token. Please log in again!', 401));
      }
      if (error.name === 'TokenExpiredError') {
        return next(
          new AppError('Your token has expired! Please log in again.', 401)
        );
      }
      next(error);
    }
  };
};

// Only for rendered pages, no errors!
export const isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verify token
      const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);

      // 2) Check if user still exists
      const currentUser = await Buyer.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

// Restrict to certain roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is an array of allowed roles ['admin', 'buyer', 'seller', 'organizer']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

export default {
  protect,
  isLoggedIn,
  restrictTo
};
