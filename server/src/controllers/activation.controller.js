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
            'SELECT id, hardware_binding_id, bond_window_expires_at FROM digital_activations WHERE order_id = $1 AND product_id = $2',
            [orderId, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Activation record not found. Please download the file first.'
            });
        }

        const activation = result.rows[0];

        // DRM-FIX-4: Enforce 24-hour binding window
        const now = new Date();
        const existingBinding = activation.hardware_binding_id;
        const windowExpires = activation.bond_window_expires_at ? new Date(activation.bond_window_expires_at) : null;

        if (existingBinding) {
            if (existingBinding === fingerprint) {
                // Same device — refresh session
                const sessionToken = crypto.randomBytes(16).toString('hex');
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
                await pool.query(
                    'UPDATE digital_activations SET session_token = $1, session_expires_at = $2 WHERE id = $3',
                    [sessionToken, expiresAt, activation.id]
                );
                return res.json({ success: true, message: 'Device verified.', sessionToken });
            }

            // Different device — check if binding window has expired
            if (windowExpires && now < windowExpires) {
                const hoursLeft = Math.ceil((windowExpires.getTime() - now.getTime()) / (1000 * 60 * 60));
                return res.status(403).json({
                    success: false,
                    message: `This file is bonded to another device. You can switch devices in ${hoursLeft} hours.`
                });
            }

            // Window expired — allow re-bonding to new device
            logger.info(`[DRM] Re-bonding product ${productId} to new device ${fingerprint} (Window expired for ${existingBinding})`);
        }

        // Bond the device (Set/Reset 24h window)
        const sessionToken = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const newWindow = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h binding

        await pool.query(
            `UPDATE digital_activations 
             SET hardware_binding_id = $1, 
                 bond_window_expires_at = $2,
                 activated_at = NOW(), 
                 session_token = $3, 
                 session_expires_at = $4 
             WHERE id = $5`,
            [fingerprint, newWindow, sessionToken, expiresAt, activation.id]
        );

        res.json({
            success: true,
            message: 'Hardware bonded successfully for 24 hours.',
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
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins session
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
 * Redeem session token — streams decrypted file content server-side.
 * The master key is NEVER sent to the client (C-1 fix).
 */
export const redeemSession = async (req, res) => {
    try {
        const { sessionToken, orderNumber, productId } = req.body;

        // Fetch activation + file path — DRM-FIX-1: master_key is removed from SELECT
        const result = await pool.query(
            `SELECT da.id, da.session_expires_at, da.bond_window_expires_at, po.buyer_id, po.id as order_id,
                    p.digital_file_path, p.digital_file_name, p.name as product_name
             FROM digital_activations da
             JOIN product_orders po ON da.order_id = po.id
             JOIN products p ON da.product_id = p.id
             WHERE da.session_token = $1 AND da.product_id = $2
             AND po.order_number = $3`,
            [sessionToken, productId, orderNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid session.' });
        }

        const { id: activationId, session_expires_at, buyer_id,
            digital_file_path, digital_file_name, product_name } = result.rows[0];

        // Check expiry
        if (new Date() > new Date(session_expires_at)) {
            return res.status(410).json({ success: false, message: 'Session expired.' });
        }

        // Ownership check
        if (buyer_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        // Invalidate the token immediately after use (single-use)
        await pool.query(
            'UPDATE digital_activations SET session_token = NULL, session_expires_at = NULL WHERE id = $1',
            [activationId]
        );

        // DRM-FIX-5: Implementation of streaming decryption
        if (digital_file_path) {
            try {
                const pathMod = await import('path');
                const fsMod = await import('fs');

                let absolutePath = pathMod.default.resolve(process.cwd(), digital_file_path);
                if (!fsMod.default.existsSync(absolutePath)) {
                    const fallback = pathMod.default.resolve(process.cwd(), 'server', digital_file_path);
                    if (fsMod.default.existsSync(fallback)) absolutePath = fallback;
                }

                if (fsMod.default.existsSync(absolutePath)) {
                    const { unwrapFile } = await import('../utils/encryptor.js');
                    const bybxBuffer = fsMod.default.readFileSync(absolutePath);

                    // Use master key from ENV per DRM-FIX-1
                    const decrypted = unwrapFile(bybxBuffer, process.env.DRM_MASTER_KEY);

                    const outName = (digital_file_name || product_name || 'download').replace(/\.bybx$/, '');
                    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.setHeader('Content-Length', decrypted.length);
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    return res.send(decrypted);
                }
            } catch (decryptErr) {
                console.error('Error decrypting/streaming file in redeemSession:', decryptErr);
                // Fall through to success response so client can re-try
            }
        }

        // Fallback: session was valid and consumed — signal success without leaking key
        res.json({ success: true });

    } catch (error) {
        console.error('Error redeeming session:', error);
        res.status(500).json({ success: false, message: 'Redemption failed.' });
    }
};
