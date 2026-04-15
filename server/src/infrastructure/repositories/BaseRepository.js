import { toCamelCase } from '../../utils/caseUtils.js';
import { pool } from '../db/pool.js';

export class BaseRepository {
    constructor(tableName, db = pool) {
        this.tableName = tableName;
        this.db = db;
    }

    async findById(id, client = this.db) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const result = await client.query(query, [id]);
        return toCamelCase(result.rows[0]);
    }

    async findByIdWithLock(id, client = this.db) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1 FOR UPDATE`;
        const result = await client.query(query, [id]);
        return toCamelCase(result.rows[0]);
    }

    async delete(id, client = this.db) {
        const { rowCount } = await client.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
        return rowCount > 0;
    }

    mapToCamelCase(row) {
        return toCamelCase(row);
    }

    mapAllToCamelCase(rows) {
        return rows.map(toCamelCase);
    }
}
