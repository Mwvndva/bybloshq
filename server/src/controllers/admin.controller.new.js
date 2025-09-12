const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const AppError = require('../utils/appError');
const dotenv = require('dotenv');

dotenv.config();

// Helper function to send success response
const sendSuccess = (res, statusCode, data, message = 'Success') => {
  res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
};

// Helper function to send error response
const sendError = (res, statusCode, message) => {
  res.status(statusCode).json({
    status: 'fail',
    message,
  });
};

// Admin login
const adminLogin = async (req, res, next) => {
  try {
    const { pin } = req.body;

    // 1) Check if pin exists
    if (!pin) {
      return next(new AppError('Please provide a PIN', 400));
    }

    // 2) Check if pin is correct
    if (pin !== process.env.ADMIN_PIN) {
      return next(new AppError('Incorrect PIN', 401));
    }

    // 3) If everything is ok, send token to client
    const token = jwt.sign({ id: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    // 4) Send response with token
    sendSuccess(res, 200, { token }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

// Middleware to protect admin routes
const protect = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user is admin
    if (decoded.id !== 'admin') {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    // 4) Add admin user to request
    req.user = { 
      id: 'admin', 
      email: 'admin@byblos.com',
      role: 'admin',
      userType: 'admin'
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired! Please log in again.', 401));
    }
    next(error);
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res, next) => {
  try {
    // Placeholder for dashboard stats
    const stats = {
      totalSellers: 0,
      totalOrganizers: 0,
      totalProducts: 0,
      totalEvents: 0,
      recentSellers: [],
      recentOrganizers: [],
      recentProducts: [],
      recentEvents: [],
    };

    sendSuccess(res, 200, stats, 'Dashboard stats retrieved successfully');
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    next(error);
  }
};

// Sellers management
const getAllSellers = async (req, res, next) => {
  try {
    const sellers = [];
    sendSuccess(res, 200, { results: sellers.length, sellers });
  } catch (error) {
    console.error('Error getting sellers:', error);
    next(error);
  }
};

const getSellerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const seller = null;
    if (!seller) {
      return next(new AppError('No seller found with that ID', 404));
    }
    sendSuccess(res, 200, { seller });
  } catch (error) {
    next(error);
  }
};

const updateSellerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }
    sendSuccess(res, 200, { status }, 'Seller status updated successfully');
  } catch (error) {
    next(error);
  }
};

// Organizers management
const getAllOrganizers = async (req, res, next) => {
  try {
    const organizers = [];
    sendSuccess(res, 200, { results: organizers.length, organizers });
  } catch (error) {
    next(error);
  }
};

const getOrganizerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizer = null;
    if (!organizer) {
      return next(new AppError('No organizer found with that ID', 404));
    }
    sendSuccess(res, 200, { organizer });
  } catch (error) {
    next(error);
  }
};

const updateOrganizerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }
    sendSuccess(res, 200, { status }, 'Organizer status updated successfully');
  } catch (error) {
    next(error);
  }
};

// Events management
const getAllEvents = async (req, res, next) => {
  try {
    const events = [];
    sendSuccess(res, 200, { results: events.length, events });
  } catch (error) {
    next(error);
  }
};

const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = null;
    if (!event) {
      return next(new AppError('No event found with that ID', 404));
    }
    sendSuccess(res, 200, { event });
  } catch (error) {
    next(error);
  }
};

const updateEventStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }
    sendSuccess(res, 200, { status }, 'Event status updated successfully');
  } catch (error) {
    next(error);
  }
};

// Products management
const getAllProducts = async (req, res, next) => {
  try {
    const products = [];
    sendSuccess(res, 200, { results: products.length, products });
  } catch (error) {
    next(error);
  }
};

const getSellerProducts = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const products = [];
    sendSuccess(res, 200, { results: products.length, products });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminLogin,
  protect,
  getDashboardStats,
  getAllSellers,
  getSellerById,
  updateSellerStatus,
  getAllOrganizers,
  getOrganizerById,
  updateOrganizerStatus,
  getAllEvents,
  getEventById,
  updateEventStatus,
  getAllProducts,
  getSellerProducts,
  sendSuccess,
  sendError
};
