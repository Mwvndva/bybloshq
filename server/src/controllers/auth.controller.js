import jwt from 'jsonwebtoken';
import Organizer from '../models/organizer.model.js';

const generateToken = (id, role = 'buyer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

export const register = async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    // Check if organizer already exists
    const organizerExists = await Organizer.findByEmail(email);
    if (organizerExists) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already in use'
      });
    }

    // Create new organizer
    const organizer = await Organizer.create({
      full_name,
      email,
      phone,
      password
    });

    // Generate JWT token with organizer role
    const token = generateToken(organizer.id, 'organizer');

    res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      data: {
        organizer: {
          id: organizer.id,
          full_name: organizer.full_name,
          email: organizer.email,
          phone: organizer.phone
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if organizer exists
    const organizer = await Organizer.findByEmail(email);
    if (!organizer) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Check if password is correct
    const isPasswordValid = await Organizer.comparePassword(password, organizer.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await Organizer.updateLastLogin(organizer.id);

    // Generate JWT token with organizer role
    const token = generateToken(organizer.id, 'organizer');
    
    // Set token as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      sameSite: 'lax', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Also send token in response body for clients that can't use cookies
    res.status(200).json({
      status: 'success',
      data: {
        organizer: {
          id: organizer.id,
          full_name: organizer.full_name,
          email: organizer.email,
          phone: organizer.phone
        },
        token // Still include token in response for client-side storage if needed
      }
    });
    
    console.log('Login successful for organizer:', organizer.email);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    // Get user ID from req.user which is set by the auth middleware
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
        message: 'Organizer not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        organizer: {
          id: organizer.id,
          full_name: organizer.full_name,
          email: organizer.email,
          phone: organizer.phone
        }
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching user data'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    const organizerId = req.organizer.id;

    // Check if email is being updated and if it's already in use
    if (email) {
      const existingOrganizer = await Organizer.findByEmail(email);
      if (existingOrganizer && existingOrganizer.id !== organizerId) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already in use by another account'
        });
      }
    }

    // Update organizer
    const updatedOrganizer = await Organizer.findByIdAndUpdate(
      organizerId,
      { full_name, email, phone },
      { new: true, runValidators: true }
    );

    if (!updatedOrganizer) {
      return res.status(404).json({
        status: 'error',
        message: 'Organizer not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        organizer: {
          id: updatedOrganizer.id,
          full_name: updatedOrganizer.full_name,
          email: updatedOrganizer.email,
          phone: updatedOrganizer.phone
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating profile'
    });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const organizerId = req.organizer.id;

    // Find organizer
    const organizer = await Organizer.findById(organizerId).select('+password');
    
    if (!organizer) {
      return res.status(404).json({
        status: 'error',
        message: 'Organizer not found'
      });
    }

    // Check if current password is correct
    const isMatch = await organizer.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Update password
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
      message: 'An error occurred while updating password'
    });
  }
};

export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if organizer still exists
    const currentOrganizer = await Organizer.findById(decoded.id);
    if (!currentOrganizer) {
      return res.status(401).json({
        status: 'error',
        message: 'The organizer belonging to this token no longer exists.'
      });
    }

    // Grant access to protected route
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
        message: 'Your token has expired. Please log in again!'
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
