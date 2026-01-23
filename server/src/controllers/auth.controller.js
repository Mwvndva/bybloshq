import OrganizerService from '../services/organizer.service.js';
import { sanitizeOrganizer } from '../utils/sanitize.js';
import jwt from 'jsonwebtoken';

const sendTokenResponse = (organizer, statusCode, res, message) => {
  const token = OrganizerService.generateToken(organizer.id);

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

  res.cookie('jwt', token, cookieOptions);

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

    if (password !== passwordConfirm) {
      return res.status(400).json({ status: 'error', message: 'Passwords do not match' });
    }

    try {
      const organizer = await OrganizerService.register({ full_name, email, phone, password });
      sendTokenResponse(organizer, 201, res, 'Registration successful');
    } catch (err) {
      if (err.code === '23505') { // Unique constraint
        return res.status(400).json({ status: 'error', message: 'Email already exists' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const organizer = await OrganizerService.login(email, password);

    if (!organizer) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    sendTokenResponse(organizer, 200, res, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'User not authenticated' });

    const organizer = await OrganizerService.getProfile(userId);
    if (!organizer) return res.status(404).json({ status: 'error', message: 'User not found' });

    res.status(200).json({
      status: 'success',
      data: { organizer: sanitizeOrganizer(organizer) }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    const organizerId = req.user.id; // Standardized req.user

    const updatedOrganizer = await OrganizerService.updateProfile(organizerId, { full_name, email, phone });

    if (!updatedOrganizer) return res.status(404).json({ status: 'error', message: 'User not found' });

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { organizer: sanitizeOrganizer(updatedOrganizer) }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const organizerId = req.user.id; // Standardized

    await OrganizerService.updatePassword(organizerId, currentPassword, newPassword);

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    const status = error.message.includes('incorrect') ? 401 : 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Not authorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentOrganizer = await OrganizerService.getProfile(decoded.id);

    if (!currentOrganizer) {
      return res.status(401).json({ status: 'error', message: 'User no longer exists' });
    }

    req.user = currentOrganizer;
    req.organizer = currentOrganizer; // Compat
    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Not authorized' });
  }
};
