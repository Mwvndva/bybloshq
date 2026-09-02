import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define your website URL
const siteUrl = 'https://www.byblosafrica.site';

// Static routes
const routes = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/shop', changefreq: 'daily', priority: 0.9 },
  { url: '/shop/women', changefreq: 'daily', priority: 0.8 },
  { url: '/shop/men', changefreq: 'daily', priority: 0.8 },
  { url: '/shop/shoes', changefreq: 'daily', priority: 0.8 },
  { url: '/shop/vintage', changefreq: 'daily', priority: 0.8 },
  { url: '/sell', changefreq: 'weekly', priority: 0.7 },
  { url: '/about', changefreq: 'monthly', priority: 0.5 },
  { url: '/contact', changefreq: 'monthly', priority: 0.5 },
  { url: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { url: '/terms', changefreq: 'yearly', priority: 0.3 },
];

async function fetchDynamicSellerRoutes() {
  const dbUrl = process.env.DB_URL || 'postgresql://byblos_user:DgpNqT0uXz7RIPKLGuDSVxDSWyqsK6d2@dpg-d9u7gq3m8hqs73ennd20-a.frankfurt-postgres.render.com/bybloshqdb';
  try {
    const pg = await import('../server/node_modules/pg/lib/index.js');
    const { Pool } = pg.default || pg;
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const { rows } = await pool.query(
      `SELECT shop_name, slug FROM sellers WHERE status = 'active'`
    );
    await pool.end();

    const dynamicRoutes = [];
    for (const seller of rows) {
      const identifier = seller.slug || encodeURIComponent(seller.shop_name);
      if (identifier) {
        dynamicRoutes.push({ url: `/shop/${identifier}`, changefreq: 'daily', priority: 0.9 });
        dynamicRoutes.push({ url: `/${identifier}`, changefreq: 'daily', priority: 0.9 });
      }
    }
    return dynamicRoutes;
  } catch (error) {
    console.warn('Could not fetch dynamic seller routes for sitemap:', error.message);
    return [];
  }
}

// Generate sitemap
async function generateSitemap() {
  try {
    const dynamicRoutes = await fetchDynamicSellerRoutes();
    const allRoutes = [...routes, ...dynamicRoutes];

    // Create a stream to write to
    const stream = new SitemapStream({ hostname: siteUrl });
    
    // Add all routes to the sitemap
    const xmlString = await streamToPromise(
      Readable.from(allRoutes).pipe(stream)
    ).then((data) => data.toString());

    // Define the path
    const publicDir = join(process.cwd(), 'public');
    const sitemapPath = join(publicDir, 'sitemap.xml');

    // Ensure public directory exists
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true });
    }

    // Write sitemap to file
    writeFileSync(sitemapPath, xmlString);

    console.log(`Sitemap generated successfully with ${allRoutes.length} URLs!`);
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

generateSitemap();
