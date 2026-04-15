import { BaseRepository } from './BaseRepository.js';
import { toCamelCase } from '../../utils/caseUtils.js';

export class SellerRepository extends BaseRepository {
    constructor(db) {
        super('sellers', db);
    }

    async create(data, client = this.db) {
        const { fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId = null, termsAccepted = false } = data;

        const result = await client.query(
            `INSERT INTO sellers (full_name, shop_name, email, whatsapp_number, city, location, physical_address, latitude, longitude, user_id, terms_accepted, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $11 = true THEN NOW() ELSE NULL END)
       RETURNING *`,
            [fullName, shopName, email, whatsappNumber, city, location, physicalAddress, latitude, longitude, userId, termsAccepted]
        );
        return toCamelCase(result.rows[0]);
    }

    async findByEmail(email, client = this.db) {
        if (!email) return null;
        const result = await client.query(
            `SELECT * FROM sellers WHERE LOWER(email) = $1`,
            [email.toLowerCase()]
        );
        return toCamelCase(result.rows[0]);
    }

    async findByUserId(userId, client = this.db) {
        const result = await client.query(
            `SELECT 
        id, 
        user_id AS "userId",
        full_name AS "fullName", 
        shop_name AS "shopName", 
        email, 
        whatsapp_number AS "whatsappNumber", 
        city,
        location,
        banner_image AS "bannerImage",
        theme,
        total_sales AS "totalSales",
        net_revenue AS "netRevenue",
        balance,
        client_count AS "clientCount",
        instagram_link AS "instagramLink",
        tiktok_link AS "tiktokLink",
        facebook_link AS "facebookLink",
        physical_address AS "physicalAddress",
        latitude,
        longitude,
        created_at AS "createdAt"
       FROM sellers 
       WHERE user_id = $1`,
            [userId]
        );
        return toCamelCase(result.rows[0]);
    }

    async findByShopNameOrSlug(shopName, client = this.db) {
        const queryText = `
      SELECT 
        id, 
        full_name AS "fullName", 
        shop_name AS "shopName", 
        email, 
        whatsapp_number AS "whatsappNumber", 
        city, 
        location, 
        physical_address AS "physicalAddress",
        latitude,
        longitude,
        banner_image AS "bannerImage",
        theme,
        instagram_link AS "instagramLink",
        tiktok_link AS "tiktokLink",
        facebook_link AS "facebookLink",
        total_sales AS "totalSales",
        net_revenue AS "netRevenue",
        balance,
        client_count AS "clientCount",
        created_at AS "createdAt"
      FROM sellers 
      WHERE slug = $1 OR LOWER(shop_name) = LOWER($1)
    `;
        const result = await client.query(queryText, [shopName.toLowerCase()]);
        return toCamelCase(result.rows[0]);
    }

    async update(id, updates, client = this.db) {
        const updatesList = [];
        const values = [id];
        let paramCount = 1;

        // Mapping of JS property names to DB column names
        const mapping = {
            fullName: 'full_name',
            shopName: 'shop_name',
            email: 'email',
            whatsappNumber: 'whatsapp_number',
            city: 'city',
            location: 'location',
            bannerImage: 'banner_image',
            banner_image: 'banner_image', // compatibility
            theme: 'theme',
            instagramLink: 'instagram_link',
            instagram_link: 'instagram_link',
            tiktokLink: 'tiktok_link',
            tiktok_link: 'tiktok_link',
            facebookLink: 'facebook_link',
            facebook_link: 'facebook_link',
            physicalAddress: 'physical_address',
            latitude: 'latitude',
            longitude: 'longitude'
        };

        for (const [key, dbCol] of Object.entries(mapping)) {
            if (updates[key] !== undefined) {
                paramCount++;
                updatesList.push(`${dbCol} = $${paramCount}`);
                values.push(updates[key]);
            }
        }

        if (updatesList.length === 0) return null;

        const queryText = `
      UPDATE sellers
      SET ${updatesList.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id, user_id AS "userId", full_name AS "fullName", shop_name AS "shopName", email, 
        whatsapp_number AS "whatsappNumber", city, location, banner_image AS "bannerImage",
        theme, instagram_link AS "instagramLink", tiktok_link AS "tiktokLink",
        facebook_link AS "facebookLink", total_sales AS "totalSales", net_revenue AS "netRevenue",
        balance, client_count AS "clientCount", physical_address AS "physicalAddress",
        latitude, longitude, created_at AS "createdAt"
    `;

        const result = await client.query(queryText, values);
        return toCamelCase(result.rows[0]);
    }

    async isShopNameAvailable(shopName, client = this.db) {
        const result = await client.query("SELECT 1 FROM sellers WHERE LOWER(shop_name) = LOWER($1)", [shopName]);
        return result.rowCount === 0;
    }

    async findByUserIdWithLock(userId, client = this.db) {
        const result = await client.query('SELECT * FROM sellers WHERE user_id = $1 FOR UPDATE', [userId]);
        return result.rows[0];
    }

    async becomeClient(sellerId, userId, client = this.db) {
        // 1. Check if relationship already exists
        const check = await client.query(
            'SELECT 1 FROM seller_clients WHERE seller_id = $1 AND user_id = $2',
            [sellerId, userId]
        );

        if (check.rowCount > 0) return { alreadyClient: true };

        // 2. Insert into seller_clients
        await client.query(
            'INSERT INTO seller_clients (seller_id, user_id) VALUES ($1, $2)',
            [sellerId, userId]
        );

        // 3. Increment client_count
        const updateResult = await client.query(
            'UPDATE sellers SET client_count = COALESCE(client_count, 0) + 1 WHERE id = $1 RETURNING client_count',
            [sellerId]
        );

        return { clientCount: updateResult.rows[0].client_count, alreadyClient: false };
    }

    async removeClient(sellerId, userId, client = this.db) {
        const check = await client.query(
            'SELECT 1 FROM seller_clients WHERE seller_id = $1 AND user_id = $2',
            [sellerId, userId]
        );

        if (check.rowCount === 0) return { wasClient: false };

        await client.query(
            'DELETE FROM seller_clients WHERE seller_id = $1 AND user_id = $2',
            [sellerId, userId]
        );

        const updateResult = await client.query(
            'UPDATE sellers SET client_count = GREATEST(COALESCE(client_count, 0) - 1, 0) WHERE id = $1 RETURNING client_count',
            [sellerId]
        );

        return { clientCount: updateResult.rows[0].client_count, wasClient: true };
    }

    async findSellersByUserId(userId, client = this.db) {
        const result = await client.query(
            `SELECT 
        s.id, s.full_name AS "fullName", s.shop_name AS "shopName", s.city, 
        s.location, s.banner_image AS "bannerImage", s.theme, s.instagram_link AS "instagramLink",
        s.client_count AS "clientCount", s.created_at AS "createdAt"
       FROM sellers s
       JOIN seller_clients sc ON s.id = sc.seller_id
       WHERE sc.user_id = $1
       ORDER BY sc.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
}
