import { pool } from '../config/database.js';

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

        // Get the order ID from order number
        const orderResult = await pool.query(
            'SELECT id FROM product_orders WHERE order_number = $1',
            [orderNumber]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found.'
            });
        }

        const orderId = orderResult.rows[0].id;

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
                return res.json({
                    success: true,
                    message: 'Device already bonded.',
                    decryptionKey: activation.master_key
                });
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'This file is already bonded to another device.'
                });
            }
        }

        // Bond the device
        await pool.query(
            'UPDATE digital_activations SET hardware_binding_id = $1, activated_at = NOW() WHERE id = $2',
            [fingerprint, activation.id]
        );

        res.json({
            success: true,
            message: 'Hardware bonded successfully.',
            decryptionKey: activation.master_key
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
 * Verify hardware fingerprint and return key
 */
export const verifyHardware = async (req, res) => {
    try {
        const { orderNumber, productId, fingerprint } = req.body;

        const orderResult = await pool.query(
            'SELECT id FROM product_orders WHERE order_number = $1',
            [orderNumber]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const orderId = orderResult.rows[0].id;

        const result = await pool.query(
            'SELECT master_key, hardware_binding_id FROM digital_activations WHERE order_id = $1 AND product_id = $2',
            [orderId, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Activation record not found.' });
        }

        const { master_key, hardware_binding_id } = result.rows[0];

        if (!hardware_binding_id) {
            return res.status(400).json({ success: false, mssage: 'File not yet activated.' });
        }

        if (hardware_binding_id !== fingerprint) {
            return res.status(403).json({ success: false, message: 'Hardware mismatch. Access denied.' });
        }

        res.json({
            success: true,
            decryptionKey: master_key
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
