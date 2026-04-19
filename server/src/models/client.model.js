import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Client Model - Manages client information for seller-initiated orders
 */
class ClientModel {
    /**
     * Insert or update a client for a specific seller
     * Uses upsert pattern: insert if new, update name if exists
     * 
     * @param {Object} client - Pool client for transaction support
     * @param {number} sellerId - The seller's ID
     * @param {string} fullName - Client's full name
     * @param {string} phone - Client's phone number (used for M-Pesa)
     * @returns {Promise<Object>} The created or updated client record
     */
    static async upsertClient(client, sellerId, fullName, phone) {
        try {
            const executor = client || pool;

            logger.info(`[ClientModel] Upserting client for seller ${sellerId}: ${fullName}, ${phone}`);

            const query = `
        INSERT INTO clients (seller_id, full_name, phone, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (seller_id, phone)
        DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          updated_at = NOW()
        RETURNING *
      `;

            const values = [sellerId, fullName.trim(), phone.trim()];
            const result = await executor.query(query, values);

            logger.info(`[ClientModel] Client upserted successfully: ID ${result.rows[0].id}`);
            return result.rows[0];

        } catch (error) {
            logger.error('[ClientModel] Error upserting client:', error);
            throw error;
        }
    }

    /**
     * Get all clients for a specific seller
     * 
     * @param {number} sellerId - The seller's ID
     * @returns {Promise<Array>} List of clients
     */
    static async getBySellerID(sellerId) {
        try {
            const query = `
        SELECT * FROM clients 
        WHERE seller_id = $1 
        ORDER BY created_at DESC
      `;

            const result = await pool.query(query, [sellerId]);
            return result.rows;

        } catch (error) {
            logger.error('[ClientModel] Error fetching clients:', error);
            throw error;
        }
    }

    /**
     * Find a specific client by seller and phone
     * 
     * @param {number} sellerId - The seller's ID
     * @param {string} phone - Client's phone number
     * @returns {Promise<Object|null>} The client record or null if not found
     */
    static async findBySellerAndPhone(sellerId, phone) {
        try {
            const query = `
        SELECT * FROM clients 
        WHERE seller_id = $1 AND phone = $2
      `;

            const result = await pool.query(query, [sellerId, phone.trim()]);
            return result.rows[0] || null;

        } catch (error) {
            logger.error('[ClientModel] Error finding client:', error);
            throw error;
        }
    }

    /**
     * Delete a client
     * 
     * @param {number} clientId - The client's ID
     * @param {number} sellerId - The seller's ID (for authorization)
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    static async delete(clientId, sellerId) {
        try {
            const query = `
        DELETE FROM clients 
        WHERE id = $1 AND seller_id = $2
      `;

            const result = await pool.query(query, [clientId, sellerId]);
            return result.rowCount > 0;

        } catch (error) {
            logger.error('[ClientModel] Error deleting client:', error);
            throw error;
        }
    }
}

export default ClientModel;
