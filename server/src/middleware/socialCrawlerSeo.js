import { pool } from '../shared/db/database.js';

// Social bot User-Agent detection pattern
const SOCIAL_BOT_PATTERN = /(WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|TelegramBot|Discordbot|SkypeUriPreview|Slackbot-LinkExpanding)/i;

/**
 * Middleware to intercept requests from social media crawlers
 * visiting /shop/:slug or /:slug and return HTML with dynamic Open Graph meta tags.
 */
export async function handleSocialCrawlerSeo(req, res, next) {
    const userAgent = req.headers['user-agent'] || '';

    // Only intercept if it's a GET request from a known social media crawler bot
    if (req.method !== 'GET' || !SOCIAL_BOT_PATTERN.test(userAgent)) {
        return next();
    }

    const path = req.path;
    let shopSlug = null;

    if (path.startsWith('/shop/')) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 2) shopSlug = parts[1];
    } else if (path !== '/' && !path.startsWith('/api') && !path.startsWith('/uploads')) {
        shopSlug = path.replace(/^\//, '').split('/')[0];
    }

    if (!shopSlug) return next();

    try {
        const result = await pool.query(
            `SELECT shop_name, business_name, bio, business_photo_url, banner_url, shop_slug
             FROM seller_profiles
             WHERE LOWER(shop_slug) = LOWER($1) AND is_active = true AND status = 'approved'
             LIMIT 1`,
            [shopSlug]
        );

        if (result.rows.length === 0) return next();

        const seller = result.rows[0];
        const title = `${seller.shop_name || seller.business_name} | Byblos`;
        const description = seller.bio || `Explore products and order securely from ${seller.shop_name || seller.business_name} on Byblos.`;
        const image = seller.business_photo_url || seller.banner_url || 'https://www.byblosafrica.site/images/og-image.jpg';
        const url = `https://www.byblosafrica.site/shop/${seller.shop_slug}`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${url}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="${image}">
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="${url}">Visit Shop</a>
</body>
</html>`;

        res.header('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch {
        return next();
    }
}
