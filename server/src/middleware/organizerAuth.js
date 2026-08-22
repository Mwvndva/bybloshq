import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

export const protect = async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in! Please log in to get access.'
      });
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if organizer still exists
    const result = await query(
      'SELECT id, email FROM organizers WHERE id = $1',
      [decoded.id]
    );
    
    const currentOrganizer = result.rows[0];

    if (!currentOrganizer) {
      return res.status(401).json({
        status: 'error',
        message: 'The organizer belonging to this token no longer exists.'
      });
    }

    // 4) Grant access to protected route
    req.user = currentOrganizer;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token. Please log in again!'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Your token has expired! Please log in again.'
      });
    }
    
    console.error('Authentication error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during authentication',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};
