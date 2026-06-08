/**
 * marketingAuth.js
 * Lightweight middleware that validates marketing JWT tokens.
 * Marketing tokens have role='marketing' — they grant read-only dashboard access.
 */
import jwt from 'jsonwebtoken'
import { AppError } from '../shared/utils/errorHandler.js'
import { query } from '../shared/db/database.js'

export const protectMarketing = async (req, res, next) => {
    try {
        const authHeader = req?.headers?.authorization
        if (!authHeader?.startsWith('Bearer ')) {
            return next(new AppError('Marketing authentication required', 401))
        }

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, globalThis.process?.env?.JWT_SECRET)

        if (decoded?.role !== 'marketing' && decoded?.role !== 'admin') {
            return next(new AppError('Insufficient permissions for marketing dashboard', 403))
        }

        const { rows } = await query(
            `SELECT id, email, role, is_active
             FROM users
             WHERE id = $1
               AND is_active = true
               AND role = ANY($2::text[])
             LIMIT 1`,
            [decoded.id, ['marketing', 'admin']]
        )
        const user = rows[0]

        if (!user) {
            return next(new AppError('Insufficient permissions for marketing dashboard', 403))
        }

        req.marketingUser = { id: user.id, email: user.email, role: user.role }
        next()
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new AppError('Session expired. Please log in again.', 401))
        }
        return next(new AppError('Invalid authentication token', 401))
    }
}

