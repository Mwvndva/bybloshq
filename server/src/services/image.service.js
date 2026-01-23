import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageService {
    constructor() {
        // Images will be stored in /uploads/images/ at project root
        // This matches the static file serving in index.js: app.use('/uploads', express.static(uploadsDir))
        // where uploadsDir = process.cwd() + '/uploads'
        this.uploadDir = path.join(process.cwd(), 'server', 'uploads', 'images');
        this.baseUrl = process.env.BACKEND_URL || 'https://bybloshq.space';

        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Convert base64 image to file and return short URL
     * @param {string} base64String - The base64 encoded image string
     * @param {string} prefix - Optional prefix for filename (e.g., 'product', 'seller')
     * @returns {Promise<string>} - Short URL path to the image
     */
    async base64ToFile(base64String, prefix = 'img') {
        try {
            // Check if it's already a URL
            if (!base64String || !base64String.startsWith('data:image')) {
                return base64String; // Already converted or invalid
            }

            // Extract image data and mime type
            const matches = base64String.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
            if (!matches || matches.length !== 3) {
                throw new Error('Invalid base64 image string');
            }

            const extension = matches[1]; // jpeg, png, etc.
            const imageData = matches[2];
            const buffer = Buffer.from(imageData, 'base64');

            // Generate unique filename
            const hash = crypto.createHash('md5').update(imageData).digest('hex').substring(0, 12);
            const timestamp = Date.now();
            const filename = `${prefix}_${timestamp}_${hash}.${extension}`;
            const filepath = path.join(this.uploadDir, filename);

            // Write file to disk
            await fs.promises.writeFile(filepath, buffer);

            // Return short URL
            const shortUrl = `/uploads/images/${filename}`;
            logger.info(`Converted base64 image to file: ${shortUrl}`);

            return shortUrl;
        } catch (error) {
            logger.error('Error converting base64 to file:', error);
            throw error;
        }
    }

    /**
     * Convert multiple base64 images to files
     * @param {Array<string>} base64Strings - Array of base64 encoded images
     * @param {string} prefix - Optional prefix for filenames
     * @returns {Promise<Array<string>>} - Array of short URL paths
     */
    async convertMultiple(base64Strings, prefix = 'img') {
        const promises = base64Strings.map(base64 => this.base64ToFile(base64, prefix));
        return await Promise.all(promises);
    }

    /**
     * Check if a string is a base64 image
     * @param {string} str - String to check
     * @returns {boolean}
     */
    isBase64Image(str) {
        return str && typeof str === 'string' && str.startsWith('data:image');
    }

    /**
     * Delete image file
     * @param {string} imageUrl - The image URL to delete
     */
    async deleteImage(imageUrl) {
        try {
            if (!imageUrl || this.isBase64Image(imageUrl)) {
                return; // Nothing to delete
            }

            // Extract filename from URL
            const filename = path.basename(imageUrl);
            const filepath = path.join(this.uploadDir, filename);

            if (fs.existsSync(filepath)) {
                await fs.promises.unlink(filepath);
                logger.info(`Deleted image file: ${filename}`);
            }
        } catch (error) {
            logger.error('Error deleting image:', error);
        }
    }
}

export default new ImageService();
