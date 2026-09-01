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
 * Generate candidate download URLs for a Cloudinary asset.
 * Tries the direct secure CDN upload URL (where uploadToCloudinary saves raw assets),
 * followed by image and authenticated URL variants.
 *
 * @param {string} publicId - The Cloudinary public_id of the asset.
 * @param {number} [expiresInSeconds=300] - URL validity window in seconds.
 * @returns {string[]} Array of candidate URLs in fallback order.
 */
export const getDigitalAssetUrls = (publicId, expiresInSeconds = 300) => {
  if (!publicId) return [];
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return [publicId];
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return [
    // 1. Standard raw CDN URL (where uploadToCloudinary saves raw files)
    cloudinary.url(publicId, { resource_type: 'raw', type: 'upload', secure: true }),
    // 2. Standard image CDN URL (if uploaded as image)
    cloudinary.url(publicId, { resource_type: 'image', type: 'upload', secure: true }),
    // 3. Authenticated raw signed URL
    cloudinary.url(publicId, { resource_type: 'raw', type: 'authenticated', sign_url: true, secure: true, expires_at: expiresAt }),
    // 4. Authenticated image signed URL
    cloudinary.url(publicId, { resource_type: 'image', type: 'authenticated', sign_url: true, secure: true, expires_at: expiresAt }),
  ].filter(Boolean);
};

export const generateSignedDownloadUrl = (publicId, expiresInSeconds = 300, resourceType = 'raw') => {
  if (!publicId) return '';
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId;
  }
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'upload',
    secure: true,
  });
};

