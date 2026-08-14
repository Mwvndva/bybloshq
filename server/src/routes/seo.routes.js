import { Router } from 'express';
import { pool } from '../shared/db/database.js';

const router = Router();

// Dynamic /sitemap.xml generating live sitemap with all active seller shops
router.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = (process.env.FRONTEND_URL || 'https://www.byblosafrica.site').replace(/\/$/, '');

        // Static routes
        const staticRoutes = [
            { url: '/', changefreq: 'daily', priority: '1.0' },
            { url: '/shop', changefreq: 'daily', priority: '0.9' },
            { url: '/shop/women', changefreq: 'daily', priority: '0.8' },
            { url: '/shop/men', changefreq: 'daily', priority: '0.8' },
            { url: '/shop/shoes', changefreq: 'daily', priority: '0.8' },
            { url: '/shop/vintage', changefreq: 'daily', priority: '0.8' },
            { url: '/sell', changefreq: 'weekly', priority: '0.7' },
            { url: '/about', changefreq: 'monthly', priority: '0.5' },
            { url: '/contact', changefreq: 'monthly', priority: '0.5' },
            { url: '/privacy', changefreq: 'yearly', priority: '0.3' },
            { url: '/terms', changefreq: 'yearly', priority: '0.3' },
        ];

        // Fetch active approved sellers
        let sellerRows = [];
        try {
            const sellerRes = await pool.query(
                `SELECT shop_slug, updated_at FROM seller_profiles WHERE is_active = true AND status = 'approved' AND shop_slug IS NOT NULL`
            );
            sellerRows = sellerRes.rows;
        } catch {
            // Graceful fallback if DB query fails during crawl
        }

        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        for (const route of staticRoutes) {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}${route.url}</loc>\n`;
            xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
            xml += `    <priority>${route.priority}</priority>\n`;
            xml += `  </url>\n`;
        }

        for (const seller of sellerRows) {
            if (!seller.shop_slug) continue;
            const lastMod = seller.updated_at ? new Date(seller.updated_at).toISOString() : new Date().toISOString();
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/shop/${encodeURIComponent(seller.shop_slug)}</loc>\n`;
            xml += `    <lastmod>${lastMod}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        }

        xml += `</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600');
        return res.send(xml);
    } catch {
        return res.status(500).send('Error generating sitemap');
    }
});

// Serve /robots.txt dynamically
router.get('/robots.txt', (req, res) => {
    const baseUrl = (process.env.FRONTEND_URL || 'https://www.byblosafrica.site').replace(/\/$/, '');
    const robotsContent = `User-agent: *
Allow: /
Allow: /shop
Allow: /shop/*
Allow: /sell
Allow: /about
Allow: /contact
Allow: /privacy
Allow: /terms

Disallow: /buyer/
Disallow: /seller/
Disallow: /admin/
Disallow: /creator/
Disallow: /mzigo/
Disallow: /checkout
Disallow: /payment-success
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;
    res.header('Content-Type', 'text/plain');
    res.header('Cache-Control', 'public, max-age=86400');
    return res.send(robotsContent);
});

export default router;
