import { pool } from '../config/database.js';
import { toJsonb } from '../utils/order.utils.js';

class ClientDebt {
    /**
     * Create a new debt record.
     */
    static async insert(client, data) {
        const query = `
            INSERT INTO client_debts (
                seller_id, client_id, product_id, amount, quantity, is_paid, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
        `;

        const values = [
            data.seller_id,
            data.client_id,
            data.product_id,
            data.amount,
            data.quantity,
            data.is_paid ?? false
        ];

        const executor = client || pool;
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    /**
     * Mark debt as paid.
     */
    static async markAsPaid(client, debtId) {
        const query = `
            UPDATE client_debts 
            SET is_paid = true, updated_at = NOW() 
            WHERE id = $1
            RETURNING *
        `;
        const executor = client || pool;
        const { rows } = await executor.query(query, [debtId]);
        return rows[0];
    }

    static async findById(id, sellerId) {
        const query = `
            SELECT cd.*, c.phone as client_phone, c.full_name as client_name, 
                   p.name as product_name, p.id as product_id, p.price
            FROM client_debts cd
            JOIN clients c ON cd.client_id = c.id
            JOIN products p ON cd.product_id = p.id
            WHERE cd.id = $1 AND cd.seller_id = $2 AND cd.is_paid = false
        `;
        const { rows } = await pool.query(query, [id, sellerId]);
        return rows[0];
    }

    static async findByClientId(clientId) {
        const query = 'SELECT * FROM client_debts WHERE client_id = $1 ORDER BY created_at DESC';
        const { rows } = await pool.query(query, [clientId]);
        return rows;
    }

    static async findByIdForUpdate(client, id) {
        const query = 'SELECT * FROM client_debts WHERE id = $1 FOR UPDATE';
        const { rows } = await client.query(query, [id]);
        return rows[0];
    }

    static async adjustAmount(client, id, amount) {
        const query = 'UPDATE client_debts SET amount = amount + $1, updated_at = NOW() WHERE id = $2 RETURNING *';
        const { rows } = await client.query(query, [amount, id]);
        return rows[0];
    }
}

export default ClientDebt;
