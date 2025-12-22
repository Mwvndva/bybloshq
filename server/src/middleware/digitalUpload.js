import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure digital uploads directory exists
const digitalUploadsDir = path.join(process.cwd(), 'server', 'uploads', 'digital_products');
const mkdir = promisify(fs.mkdir);

const ensureDigitalDirExists = async () => {
    try {
        await mkdir(digitalUploadsDir, { recursive: true });
        console.log(`Digital uploads directory ready at: ${digitalUploadsDir}`);
    } catch (error) {
        console.error('Error creating digital uploads directory:', error);
    }
};

ensureDigitalDirExists();

// Configure disk storage for digital files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, digitalUploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-random-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for digital products
const fileFilter = (req, file, cb) => {
    // Allowed extensions
    const allowedExtensions = ['.pdf', '.zip', '.rar', '.epub', '.mobi'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Allowed file types: ${allowedExtensions.join(', ')}`), false);
    }
};

// Initialize upload middleware
const digitalUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
});

export default digitalUpload;
