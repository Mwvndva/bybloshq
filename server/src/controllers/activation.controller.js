import { pool } from '../config/database.js';
import crypto from 'crypto';

/**
 * Bond hardware fingerprint to a digital purchase
 */
export const bondHardware = async (req, res) => {
    try {
        const { orderNumber, productId, fingerprint } = req.body;

        if (!orderNumber || !productId || !fingerprint) {
            return res.status(400).json({
                success: false,
                message: 'Order number, product ID, and fingerprint are required.'
            });
        }

        // Get the order ID and buyer_id from order number
        const orderResult = await pool.query(
            'SELECT id, buyer_id FROM product_orders WHERE order_number = $1',
            [orderNumber]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found.'
            });
        }

        const { id: orderId, buyer_id } = orderResult.rows[0];

        // Ownership Check: The req.user.id is the buyer profile ID
        if (buyer_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You do not own this order.'
            });
        }

        // Check if activation already exists
        const result = await pool.query(
            'SELECT * FROM digital_activations WHERE order_id = $1 AND product_id = $2',
            [orderId, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Activation record not found. Please download the file first.'
            });
        }

        const activation = result.rows[0];

        if (activation.hardware_binding_id) {
            // Check if it matches
            if (activation.hardware_binding_id === fingerprint) {
                // Return session token instead of master key
                const sessionToken = crypto.randomBytes(16).toString('hex');
                const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds
                await pool.query(
                    'UPDATE digital_activations SET session_token = $1, session_expires_at = $2 WHERE id = $3',
                    [sessionToken, expiresAt, activation.id]
                );
                return res.json({
                    success: true,
                    message: 'Device already bonded.',
                    sessionToken
                });
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'This file is already bonded to another device.'
                });
            }
        }

        // Bond the device
        const sessionToken = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 1000);
        await pool.query(
            'UPDATE digital_activations SET hardware_binding_id = $1, activated_at = NOW(), session_token = $2, session_expires_at = $3 WHERE id = $4',
            [fingerprint, sessionToken, expiresAt, activation.id]
        );

        res.json({
            success: true,
            message: 'Hardware bonded successfully.',
            sessionToken
        });

    } catch (error) {
        console.error('Error bonding hardware:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bond hardware.',
            error: error.message
        });
    }
};

/**
 * Verify hardware fingerprint and return session token
 */
export const verifyHardware = async (req, res) => {
    try {
        const { orderNumber, productId, fingerprint } = req.body;

        const orderResult = await pool.query(
            'SELECT id, buyer_id FROM product_orders WHERE order_number = $1',
            [orderNumber]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const { id: orderId, buyer_id } = orderResult.rows[0];

        // Ownership Check
        if (buyer_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'You do not own this order.' });
        }

        const result = await pool.query(
            'SELECT id, master_key, hardware_binding_id FROM digital_activations WHERE order_id = $1 AND product_id = $2',
            [orderId, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Activation record not found.' });
        }

        const { id: activationId, hardware_binding_id } = result.rows[0];

        if (!hardware_binding_id) {
            return res.status(400).json({ success: false, message: 'File not yet activated.' });
        }

        if (hardware_binding_id !== fingerprint) {
            return res.status(403).json({ success: false, message: 'Hardware mismatch. Access denied.' });
        }

        // Generate session token
        const sessionToken = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 1000);
        await pool.query(
            'UPDATE digital_activations SET session_token = $1, session_expires_at = $2 WHERE id = $3',
            [sessionToken, expiresAt, activationId]
        );

        res.json({
            success: true,
            sessionToken
        });

    } catch (error) {
        console.error('Error verifying hardware:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed.',
            error: error.message
        });
    }
};

/**
 * Redeem session token for master key (for Service Worker only)
 */
export const redeemSession = async (req, res) => {
    try {
        const { sessionToken, orderNumber, productId } = req.body;

        const result = await pool.query(
            `SELECT da.master_key, da.session_expires_at, po.buyer_id
             FROM digital_activations da
             JOIN product_orders po ON da.order_id = po.id
             WHERE da.session_token = $1 AND da.product_id = $2
             AND po.order_number = $3`,
            [sessionToken, productId, orderNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid session.' });
        }

        const { master_key, session_expires_at, buyer_id } = result.rows[0];

        // Check expiry
        if (new Date() > new Date(session_expires_at)) {
            return res.status(410).json({ success: false, message: 'Session expired. Re-open file to refresh.' });
        }

        // Ownership Check (Double check)
        if (buyer_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        // Invalidate the token immediately after use
        await pool.query(
            'UPDATE digital_activations SET session_token = NULL, session_expires_at = NULL WHERE session_token = $1',
            [sessionToken]
        );

        res.json({
            success: true,
            masterKey: master_key
        });

    } catch (error) {
        console.error('Error redeeming session:', error);
        res.status(500).json({ success: false, message: 'Redemption failed.' });
    }
};
