import { readFileSync } from 'fs';
import { join } from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Read the sitemap file
    const sitemapPath = join(process.cwd(), 'public', 'sitemap.xml');
    const sitemap = readFileSync(sitemapPath, 'utf8');

    // Set the content type to XML
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    
    // Send the sitemap content
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Error reading sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
}
