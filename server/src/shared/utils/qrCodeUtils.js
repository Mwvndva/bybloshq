import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Save QR code data URL to a PNG file
 * @param {string} dataUrl - The data URL of the QR code
 * @param {string} filename - The filename to save as (without extension)
 * @returns {Promise<{filename: string, path: string}>} - The saved file info
 */
const saveQrCodeAsPng = async (dataUrl, filename = `qr-${Date.now()}`) => {
  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'qrcodes');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Remove the data URL prefix
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const filePath = path.join(uploadsDir, `${filename}.png`);
    
    // Write file
    await fs.promises.writeFile(filePath, base64Data, 'base64');
    
    return {
      filename: `${filename}.png`,
      path: filePath,
      url: `/uploads/qrcodes/${filename}.png`
    };
  } catch (error) {
    console.error('Error saving QR code as PNG:', error);
    throw error;
  }
};

/**
 * Convert QR code data URL to a Buffer
 * @param {string} dataUrl - The data URL of the QR code
 * @returns {Promise<Buffer>} - The PNG buffer
 */
const qrCodeToBuffer = async (dataUrl) => {
  try {
    // Remove the data URL prefix
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    console.error('Error converting QR code to buffer:', error);
    throw error;
  }
};

export { saveQrCodeAsPng, qrCodeToBuffer };
