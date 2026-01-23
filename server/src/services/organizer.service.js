import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Organizer from '../models/organizer.model.js';
import { sanitizeOrganizer } from '../utils/sanitize.js';

const SALT_ROUNDS = 10;

class OrganizerService {
    static async register(data) {
        const { full_name, email, phone, password } = data;
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        return await Organizer.create({
            full_name,
            email,
            phone,
            password: hashedPassword
        });
    }

    static async login(email, password) {
        const organizer = await Organizer.findByEmail(email);
        if (!organizer) return null;

        const isMatch = await bcrypt.compare(password, organizer.password);
        if (!isMatch) return null;

        await Organizer.updateLastLogin(organizer.id);
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
    static generateToken(id) {
        return jwt.sign({ id, role: 'organizer' }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });
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
