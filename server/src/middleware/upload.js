import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure upload and temp directories exist
const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
const tempDir = path.join(process.cwd(), 'temp');

console.log('Upload middleware initialized');
console.log('Current working directory:', process.cwd());
console.log('Uploads directory path:', uploadsDir);
console.log('Temp directory path:', tempDir);

const mkdir = promisify(fs.mkdir);

// Create directories if they don't exist
const ensureDirsExist = async () => {
  try {
    console.log('Ensuring upload directories exist...');
    await mkdir(uploadsDir, { recursive: true });
    await mkdir(tempDir, { recursive: true });
    
    // Verify directories exist
    const uploadsExists = fs.existsSync(uploadsDir);
    const tempExists = fs.existsSync(tempDir);
    
    console.log(`Uploads directory ${uploadsExists ? 'exists' : 'does not exist'}: ${uploadsDir}`);
    console.log(`Temp directory ${tempExists ? 'exists' : 'does not exist'}: ${tempDir}`);
    
    if (!uploadsExists || !tempExists) {
      throw new Error('Failed to create one or more directories');
    }
    
    console.log('Upload directories ready');
  } catch (error) {
    console.error('Error creating directories:', error);
    throw error; // Re-throw to prevent the server from starting with invalid config
  }
};

// Run this on server start
try {
  ensureDirsExist();
} catch (error) {
  console.error('Failed to initialize upload directories:', error);
  process.exit(1);
}

// Configure memory storage to handle file buffers
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req, file, cb) => {
  const filetypes = /jpe?g|png|webp/;
  const mimetypes = /^image\/(jpe?g|png|webp)$/i;

  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = mimetypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png, and .webp formats are allowed!'), false);
  }
};

// Initialize upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware to clean up temp files
const cleanupTempFiles = (req, res, next) => {
  // Clean up any temporary files after response is sent
  res.on('finish', () => {
    if (req.file && req.file.path && req.file.path.startsWith(tempDir)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error cleaning up temp file:', err);
      });
    }
  });
  next();
};

// Export both upload and cleanup middleware
export { upload, cleanupTempFiles };

export default upload;
