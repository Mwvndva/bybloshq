import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary.
 * @param {string} filePath - Local path of the temp file to upload.
 * @param {string} [folder='products'] - Cloudinary folder (relative to 'byblos/').
 * @param {string} [resourceType='auto'] - Cloudinary resource_type.
 *   Pass 'raw' for digital product files (.pdf, .zip, .epub, etc.)
 *   so that Cloudinary does not attempt image transformation.
 * @returns {Promise<object>} Cloudinary upload result (includes public_id, secure_url, etc.)
 */
export const uploadToCloudinary = async (filePath, folder = 'products', resourceType = 'auto') => {
  try {
    if (!filePath) return null;

    // Upload the file to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `byblos/${folder}`,
      resource_type: resourceType,
      unique_filename: true,
      overwrite: true,
    });

    // Delete the temporary file
    fs.unlinkSync(filePath);

    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    // Delete the temporary file in case of error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) return;

    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Generate a signed, time-limited download URL for a private Cloudinary raw asset.
 *
 * The URL is valid for `expiresInSeconds` seconds and forces a browser download
 * via the Content-Disposition: attachment header.
 *
 * IMPORTANT: For this URL to enforce access control, the digital_products folder
 * in the Cloudinary dashboard must have its delivery type set to 'authenticated'
 * (not 'upload'). Without this setting, the file is publicly accessible regardless
 * of whether the URL is signed.
 *
 * @param {string} publicId - The Cloudinary public_id of the asset (e.g. 'byblos/digital_products/abc123').
 * @param {number} [expiresInSeconds=300] - URL validity window in seconds (default 5 minutes).
 * @returns {string} A signed Cloudinary URL.
 */
export const generateSignedDownloadUrl = (publicId, expiresInSeconds = 300, resourceType = 'raw') => {
  if (!publicId) return '';
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId;
  }
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.utils.private_download_url(publicId, '', {
    resource_type: resourceType,
    expires_at: expiresAt,
    attachment: true,
  });
};

