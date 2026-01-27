import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt.js';
import Organizer from '../models/organizer.model.js';
import User from '../models/user.model.js';
import { sanitizeOrganizer } from '../utils/sanitize.js';

const SALT_ROUNDS = 10;

class OrganizerService {
    static async register(data) {
        const { full_name, email, phone, whatsappNumber, password } = data;
        const whatsapp_number = whatsappNumber || phone;

        // 1. Check if user already exists
        const existingUser = await User.findByEmail(email);

        if (existingUser) {
            // 2. Verify password matches
            const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
            if (!isPasswordCorrect) {
                throw new Error('An account with this email already exists. Please login or use the correct password to link this profile.');
            }

            // 3. Check if they already have an organizer profile
            const existingOrganizer = await Organizer.findByEmail(email);
            if (existingOrganizer) {
                throw new Error('An organizer account with this email already exists.');
            }

            // 4. Link profile to existing user identity
            return await Organizer.create({
                full_name, email, whatsapp_number, userId: existingUser.id
            });
        }

        // 5. Create BOTH user and profile
        const newUser = await User.create({
            email,
            password,
            role: 'organizer',
            is_verified: true
        });

        return await Organizer.create({
            full_name, email, whatsapp_number, userId: newUser.id
        });
    }

    static async login(email, password) {
        // 1. Find user in unified users table
        const userFound = await User.findByEmail(email);
        if (!userFound) return null;

        // 2. Verify password against unified user record
        const isValid = await User.verifyPassword(password, userFound.password_hash);
        if (!isValid) return null;

        // 3. Fetch organizer profile
        const organizer = await Organizer.findByEmail(email);
        if (organizer) {
            await Organizer.updateLastLogin(organizer.id);
        }
        return organizer;
    }

    static async getProfile(id) {
        return await Organizer.findById(id);
    }

    static async updateProfile(id, data) {
        // Check email uniqueness if email changed?
        // For now simple update.
        return await Organizer.findByIdAndUpdate(id, data);
    }

    static async updatePassword(id, currentPassword, newPassword) {
        const organizer = await Organizer.findById(id); // Needed for password hash
        if (!organizer) throw new Error('Organizer not found');

        // Manual query since we removed findById returning * (maybe?)
        // The DAO findById returns * ("SELECT *").

        const isMatch = await bcrypt.compare(currentPassword, organizer.password);
        if (!isMatch) throw new Error('Current password is incorrect');

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        return await Organizer.findByIdAndUpdate(id, { password: hashedPassword });
    }

    // Token Helpers
    static generateToken(organizer) {
        // CRITICAL: Use user_id (from users table) not id (from organizers table)
        const userId = organizer.user_id || organizer.userId;

        if (!userId) {
            throw new Error('Cannot generate token: organizer.user_id is missing. Ensure organizer data includes user_id from the users table.');
        }

        return signToken(userId, 'organizer');
    }

    static async createPasswordResetToken(email) {
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const hashedToken = await bcrypt.hash(token, SALT_ROUNDS);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await Organizer.savePasswordResetToken(email, hashedToken, expiresAt);
        return token;
    }

    static async resetPassword(email, token, newPassword) {
        const data = await Organizer.getResetTokenData(email);
        if (!data) throw new Error('Invalid or expired token');

        const isMatch = await bcrypt.compare(token, data.password_reset_token);
        if (!isMatch) throw new Error('Invalid token');

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        return await Organizer.clearResetTokenAndUpdatePassword(email, hashedPassword);
    }
}

export default OrganizerService;
