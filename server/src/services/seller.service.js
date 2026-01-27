import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt.js';
import { query, pool } from '../config/database.js'; // Assuming query is exported
import * as SellerModel from '../models/seller.model.js';
import logger from '../utils/logger.js';
import withdrawalService from './withdrawal.service.js';

const SALT_ROUNDS = 10;

import User from '../models/user.model.js';

class SellerService {

    // --- Auth ---
    static async register(data) {
        const { fullName, shopName, email, phone, whatsappNumber, password, city, location, physicalAddress, latitude, longitude } = data;
        const whatsapp_number = whatsappNumber || phone;

        // 1. Check if user already exists in unified users table
        const existingUser = await User.findByEmail(email);

        if (existingUser) {
            // 2. User exists - verify password matches
            const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
            if (!isPasswordCorrect) {
                throw new Error('An account with this email already exists. Please login or use the correct password to link this profile.');
            }

            // 3. Password correct - check if they already have a seller profile
            const existingSeller = await SellerModel.findSellerByEmail(email);
            if (existingSeller) {
                throw new Error('A seller account with this email already exists.');
            }

            // 4. Link new seller profile to existing user identity
            return await SellerModel.createSeller({
                fullName, shopName, email, whatsappNumber: whatsapp_number, city, location, physicalAddress, latitude, longitude, userId: existingUser.id
            });
        }

        // 5. No user exists - create BOTH user and profile
        // Create user first
        const newUser = await User.create({
            email,
            password,
            role: 'seller',
            is_verified: true
        });

        // Create seller profile linked to new user
        return await SellerModel.createSeller({
            fullName, shopName, email, whatsappNumber: whatsapp_number, city, location, physicalAddress, latitude, longitude, userId: newUser.id
        });
    }

    static async login(email, password) {
        // 1. Find user in unified users table
        const userFound = await User.findByEmail(email);
        if (!userFound) return null;

        // 2. Verify password against unified user record
        const isValid = await User.verifyPassword(password, userFound.password_hash);
        if (!isValid) return null;

        // 3. Fetch seller profile linked to this email
        const seller = await SellerModel.findSellerByEmail(email);
        return seller;
    }

    static generateToken(seller) {
        // CRITICAL: Use user_id (from users table) not id (from sellers table)
        // The auth middleware expects the JWT to contain the user ID from the unified users table
        const userId = seller.user_id || seller.userId;

        if (!userId) {
            throw new Error('Cannot generate token: seller.user_id is missing. Ensure seller data includes user_id from the users table.');
        }

        return signToken(userId, 'seller');
    }

    // --- Profile ---
    static async updateProfile(id, updates) {
        // handle password update logic here instead of Model
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
        }
        return await SellerModel.updateSeller(id, updates);
    }

    // --- Financials ---
    static async createWithdrawalRequest(sellerId, amount, mpesaNumber, mpesaName) {
        return await withdrawalService.createWithdrawalRequest({
            entityId: sellerId,
            entityType: 'seller',
            amount,
            mpesaNumber,
            mpesaName
        });
    }
}

export default SellerService;
