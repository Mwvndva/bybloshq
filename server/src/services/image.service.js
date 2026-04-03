import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageService {
    constructor() {
        this.uploadDir = path.join(process.cwd(), 'uploads', 'images');
        this.baseUrl = process.env.BACKEND_URL || 'https://bybloshq.space';
        this.useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);

        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }

        if (this.useCloudinary) {
            logger.info('☁️ ImageService: Cloudinary integration ACTIVE');
        } else {
            logger.warn('📁 ImageService: Local disk storage ACTIVE (Cloudinary credentials missing)');
        }
    }

    /**
     * Convert base64 image to file and upload (Cloudinary or Local)
     */
    async base64ToFile(base64String, prefix = 'img') {
        try {
            if (!base64String || !base64String.startsWith('data:image')) {
                return base64String;
            }

            const matches = base64String.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
            if (!matches || matches.length !== 3) {
                throw new Error('Invalid base64 image string');
            }

            const extension = matches[1];
            const imageData = matches[2];
            const buffer = Buffer.from(imageData, 'base64');

            // Using SHA-256 for secure hashing (SonarQube compliance)
            const hash = crypto.createHash('sha256').update(imageData).digest('hex').substring(0, 12);
            const filename = `${prefix}_${Date.now()}_${hash}.${extension}`;
            const filepath = path.join(this.uploadDir, filename);

            // 1. Always write to local temp first (required by Cloudinary uploader)
            await fs.promises.writeFile(filepath, buffer);

            // 2. If Cloudinary is configured, upload and return secure_url
            if (this.useCloudinary) {
                const folder = prefix.includes('product') ? 'products' : 'profiles';
                const result = await uploadToCloudinary(filepath, folder);

                // Note: uploadToCloudinary already deletes the local file
                logger.info(`Uploaded to Cloudinary: ${result.secure_url}`);
                return result.secure_url;
            }

            // 3. Fallback to local URL
            const shortUrl = `/uploads/images/${filename}`;
            logger.info(`Saved locally (fallback): ${shortUrl}`);
            return shortUrl;

        } catch (error) {
            logger.error('Error in ImageService.base64ToFile:', error);
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
     * Delete image file (Cloudinary or Local)
     */
    async deleteImage(imageUrl) {
        try {
            if (!imageUrl || this.isBase64Image(imageUrl)) {
                return;
            }

            // 1. Handle Cloudinary Deletion
            if (imageUrl.includes('cloudinary.com')) {
                // Extract public ID from URL: .../upload/v12345/byblos/products/img_123.jpg
                // Public ID is: byblos/products/img_123
                const parts = imageUrl.split('/');
                const uploadIndex = parts.indexOf('upload');
                if (uploadIndex !== -1) {
                    // Public ID is everything after 'upload/vXXXXX/'
                    const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
                    const publicId = publicIdWithExt.split('.')[0];

                    logger.info(`Deleting from Cloudinary: ${publicId}`);
                    await deleteFromCloudinary(publicId);
                    return;
                }
            }

            // 2. Handle Local Deletion (Fallback)
            const filename = path.basename(imageUrl);
            const filepath = path.join(this.uploadDir, filename);

            if (fs.existsSync(filepath)) {
                await fs.promises.unlink(filepath);
                logger.info(`Deleted local image file: ${filename}`);
            }
        } catch (error) {
            logger.error('Error in ImageService.deleteImage:', error);
        }
    }
}

export default new ImageService();
