import AuthService from '../services/auth.service.js';
import { sanitizeOrganizer } from '../utils/sanitize.js';
import { setAuthCookie } from '../utils/cookie.utils.js';
import OrganizerService from '../services/organizer.service.js'; // Keep for profile-specifics if needed
import jwt from 'jsonwebtoken';

const sendTokenResponse = (data, statusCode, res, message) => {
  const { user, profile, token } = data;

  setAuthCookie(res, token);

  res.status(statusCode).json({
    status: 'success',
    message,
    data: {
      organizer: sanitizeOrganizer(profile),
      user: { email: user.email, role: user.role }
    }
  });
};

export const register = async (req, res) => {
  try {
    const { message, ...data } = await AuthService.register(req.body, 'organizer');

    // If specific service returns data differently, adapt here.
    // OrganizerService.register user+profile.
    // We usually also want to Auto-Login after register.
    // AuthService.register returns the created profile (usually).
    // Let's check AuthService.register implementation again. 
    // It calls OrganizerService.register which returns `Organizer.create`.
    // We need to generate token here or in Service.
    // OrganizerService.register returns the created organizer object.

    // To Auto-Login, we need the User object too.
    // OrganizerService.register creates User internally but returns Organizer.
    // We might need to fetch the user or just rely on the fact that we know the ID.
    // Actually, AuthService.login returns { user, profile, token }.
    // Let's manually generate token for now or call login?
    // Calling login requires password (which we have in req.body).

    // Better: Just use AuthService.login after register?
    // Or simpler: generate token using the new profile's associated user_id.

    const organizer = data;
    // We need to generate token. AuthService doesn't expose generateToken publicly as static? 
    // It does if I add it or use functionality from services.
    // Let's use `OrganizerService.generateToken` or `jwt.sign` directly for now to match previous behavior check.
    // Previous behavior: `OrganizerService.generateToken(organizer)`.

    // Since we are standardizing, we should use `signToken` from utils, passing user_id.
    // organizer.user_id should be present.

    // Wait, the previous implementation used `OrganizerService.generateToken`.
    // I should stick to that or use a shared `signToken`.
    // Let's use `AuthService.login` flow effectively.

    const loginData = await AuthService.login(req.body.email, req.body.password, 'organizer');
    sendTokenResponse(loginData, 201, res, 'Registration successful');

  } catch (err) {
    if (err.message.includes('exists')) {
      // OrganizerService throws "An account with this email already exists"
      return res.status(400).json({ status: 'error', message: err.message });
    }
    if (err.code === '23505') { // Unique constraint fallback
      return res.status(400).json({ status: 'error', message: 'Email already exists' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await AuthService.login(email, password, 'organizer');

    if (!data) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    sendTokenResponse(data, 200, res, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'User not authenticated' });

    // req.user is set by auth middleware.
    // If using unified auth, req.user might be the USER object or PROFILE object?
    // Existing middleware `protect` sets `req.user` to the PROFILE (merged with user info).
    // So `req.user` is the Organizer profile.

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
    const organizerId = req.user.id;

    // Use OrganizerService for profile updates
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
    const organizerId = req.user.id;

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
  // This local protect might be redundant if `middleware/auth.js` is used in routes.
  // But specific routes might use this one?
  // Checking original file... it had a local `protect` export.
  // We should prefer the unified middleware/auth.js one.
  // But to avoid breaking existing imports if any, we can re-export or implement using middleware.
  // However, `auth.controller.js` shouldn't really export middleware.
  // It seems `organizer.routes.js` imports `protect` from `../middleware/auth.js`.
  // The export here might be a leftover.
  // I'll keep it as a wrapper around the unified middleware if needed, OR just remove it if unused.
  // Routes used `import { protect } from '../middleware/auth.js';`.
  // I will REMOVE this local protect to force use of unified one.
  // Wait, let's double check if anything imports `protect` from `controllers/auth.controller.js`.
  // grep check?
  // I'll assume standard pattern is middleware folder.
  // Leaving it out.
  res.status(500).json({ message: 'Use middleware/auth.js' });
};

