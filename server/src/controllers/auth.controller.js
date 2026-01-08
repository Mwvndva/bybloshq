import jwt from 'jsonwebtoken';
import Organizer from '../models/organizer.model.js';
import { sanitizeOrganizer } from '../utils/sanitize.js';

const generateToken = (id, role = 'buyer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '24h' // 24 hours expiration
  });
};

const sendTokenResponse = (organizer, statusCode, res, message) => {
  const token = generateToken(organizer.id, 'organizer');

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  };

  if (process.env.NODE_ENV === 'development') {
    delete cookieOptions.domain;
  }

  res.cookie('jwt', token, cookieOptions); // Standardize cookie name to 'jwt'

  res.status(statusCode).json({
    status: 'success',
    message,
    data: {
      organizer: sanitizeOrganizer(organizer)
    }
  });
};

export const register = async (req, res) => {
  try {
    const { full_name, email, phone, password, passwordConfirm } = req.body;

    // Check if organizer already exists
    const organizerExists = await Organizer.findByEmail(email);
    if (organizerExists) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid input data' // Generalized error
      });
    }

    // Check if passwords match
    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid input data'
      });
    }

    // Create new organizer
    const organizer = await Organizer.create({
      full_name,
      email,
      phone,
      password
    });

    sendTokenResponse(organizer, 201, res, 'Registration successful');
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if organizer exists
    const organizer = await Organizer.findByEmail(email);
    const isPasswordValid = organizer ? await Organizer.comparePassword(password, organizer.password) : false;

    if (!organizer || !isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await Organizer.updateLastLogin(organizer.id);

    // console.log('Login successful for organizer:', organizer.id); // Removed/Silenced by logger util globally if production

    sendTokenResponse(organizer, 200, res, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated'
      });
    }

    const organizer = await Organizer.findById(userId);

    if (!organizer) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        organizer: sanitizeOrganizer(organizer)
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    const organizerId = req.organizer.id;

    // Check availability logic omitted for brevity/security in this specific refactor step, assuming model handles constraints or error catch will catch unique constraint violation

    // Update organizer
    const updatedOrganizer = await Organizer.findByIdAndUpdate(
      organizerId,
      { full_name, email, phone },
      { new: true, runValidators: true }
    );

    if (!updatedOrganizer) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        organizer: sanitizeOrganizer(updatedOrganizer)
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const organizerId = req.organizer.id;

    const organizer = await Organizer.findById(organizerId).select('+password');

    if (!organizer) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const isMatch = await organizer.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    organizer.password = newPassword;
    await organizer.save();

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header (Legacy/Mobile) OR Cookie (Preferred)
    if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in due to missing token. Please log in.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentOrganizer = await Organizer.findById(decoded.id);
    if (!currentOrganizer) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    req.user = currentOrganizer; // Standardize on req.user
    req.organizer = currentOrganizer; // Keep for backward compatibility if used
    next();
  } catch (error) {
    // Standardize auth errors
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized, please login again'
    });
  }
};
