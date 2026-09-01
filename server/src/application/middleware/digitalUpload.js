import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import { uploadToCloudinary } from '../../shared/utils/cloudinary.js';

// Allowed extensions for digital products (documents, images, graphics, audio, video, archives, software)
const ALLOWED_EXTENSIONS = [
    // Images & Graphics
    '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif', '.ai', '.psd', '.eps', '.ico', '.raw',
    // Documents & eBooks
    '.pdf', '.epub', '.mobi', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.xls', '.ppt', '.pptx',
    // Archives & Compressed
    '.zip', '.rar', '.7z', '.tar', '.gz',
    // Audio & Video
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.mp4', '.mov', '.avi', '.mkv'
];

// File filter — validates extension before multer stores anything
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Allowed file types: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
    }
};

// Memory storage — no local disk writes; buffer goes straight to Cloudinary
const multerInstance = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB
    },
});

/**
 * Express middleware that:
 * 1. Accepts a single 'digital_file' multipart field (memory storage).
 * 2. Writes the buffer to a temp file in os.tmpdir().
 * 3. Uploads the temp file to Cloudinary as resource_type 'raw'.
 * 4. Attaches the Cloudinary result to req.cloudinaryFile.
 * 5. Cleans up the temp file regardless of success or failure.
 *
 * On success, req.cloudinaryFile will contain:
 *   - public_id          {string}  Cloudinary asset ID — stored in products.digital_file_path
 *   - secure_url         {string}  Permanent HTTPS URL (for debug only; never exposed to clients)
 *   - original_filename  {string}  Original uploaded filename
 *   - bytes              {number}  File size in bytes
 */
export const cloudinaryDigitalUpload = (req, res, next) => {
    multerInstance.single('digital_file')(req, res, async (multerErr) => {
        if (multerErr) {
            return res.status(400).json({
                status: 'error',
                message: multerErr.message || 'File upload error',
            });
        }

        if (!req.file) {
            // No file attached — let the controller handle the missing-file response
            return next();
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        const tempFileName = `digital-${crypto.randomBytes(8).toString('hex')}${ext}`;
        const tempFilePath = path.join(os.tmpdir(), tempFileName);

        try {
            await writeFile(tempFilePath, req.file.buffer);

            // uploadToCloudinary deletes the temp file on completion (success or error)
            const cloudinaryResult = await uploadToCloudinary(
                tempFilePath,
                'digital_products',
                'raw'
            );

            req.cloudinaryFile = {
                public_id: cloudinaryResult.public_id,
                secure_url: cloudinaryResult.secure_url,
                original_filename: req.file.originalname,
                bytes: req.file.size,
            };

            return next();
        } catch (uploadErr) {
            // Clean up temp file if uploadToCloudinary did not already remove it
            try {
                if (fs.existsSync(tempFilePath)) {
                    await unlink(tempFilePath);
                }
            } catch (_) { /* ignore cleanup errors */ }

            console.error('[digitalUpload] Cloudinary upload failed:', uploadErr.message);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to upload file to storage. Please try again.',
            });
        }
    });
};


