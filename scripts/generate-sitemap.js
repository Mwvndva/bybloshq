import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define your website URL
const siteUrl = 'https://bybloshq.space';

// Define your routes
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

// Generate sitemap
async function generateSitemap() {
  try {
    // Create a stream to write to
    const stream = new SitemapStream({ hostname: siteUrl });
    
    // Add all routes to the sitemap
    const xmlString = await streamToPromise(
      Readable.from(routes).pipe(stream)
    ).then((data) => data.toString());

    // Write sitemap to file
    writeFileSync(
      resolve(__dirname, '../public/sitemap.xml'),
      xmlString
    );

    console.log('Sitemap generated successfully!');
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

generateSitemap();
