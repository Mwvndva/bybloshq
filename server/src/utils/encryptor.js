import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * .BYBX File Structure:
 * [Magic (4)] "BYBX"
 * [Version (2)] 0x0001
 * [TransactionID (36)] UUID string
 * [HardwareID (64)] Fingerprint hash (filled with 0s if unactivated)
 * [IV (12)] AES-GCM IV
 * [AuthTag (16)] AES-GCM tag
 * [EncryptedData (Remaining)]
 */

const MAGIC = Buffer.from('BYBX');
const VERSION = Buffer.from([0x00, 0x01]);

/**
 * Encrypts a file into a .bybx container
 * @param {string} inputPath Path to original file
 * @param {string} transactionId Order item reference/ID
 * @param {number} productId Database ID of the product
 * @param {string} masterKey AES-256 key (32 bytes)
 * @returns {Promise<Buffer>} The .bybx file buffer
 */
export const wrapFile = async (inputPath, transactionId, productId, masterKey) => {
    const fileData = await fs.readFile(inputPath);

    // Forensic Watermarking (Simplified PoC)
    // For MP3, we could add an ID3 tag. For PDFs, metadata.
    // For this PoC, we'll just append it or log it.
    // Real implementation would use something like 'ffmpeg' or 'pdf-lib'.
    const watermarkedData = await applyForensicWatermark(fileData, transactionId, inputPath);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(masterKey, 'hex'), iv);

    const encrypted = Buffer.concat([cipher.update(watermarkedData), cipher.final()]);
    const tag = cipher.getAuthTag();

    const header = Buffer.alloc(128);
    MAGIC.copy(header, 0);
    VERSION.copy(header, 4);

    // Transaction ID (max 36 chars for UUID)
    header.write(transactionId, 6, 36, 'utf8');

    // Product ID (4 bytes integer at offset 42)
    header.writeInt32BE(productId, 42);

    // Hardware ID (max 64 chars, initially 0, start at offset 46)
    // hardware_binding_id will be handled by the client/activation flow, 
    // but the file itself doesn't need to be RE-WRITTEN if it's stored on server.
    // Wait, the requirement says "The output should be a custom .bybx container. 
    // The header must include a transaction_id and a null field for the hardware_binding_id."
    // So 64 bytes of zeros.
    header.fill(0, 46, 46 + 64);

    return Buffer.concat([
        header,
        iv,
        tag,
        encrypted
    ]);
};

/**
 * In a real scenario, this would use specific libraries for each file type
 */
async function applyForensicWatermark(data, transactionId, filePath) {
    const ext = path.extname(filePath).toLowerCase();

    // Implementation placeholder for different file types
    // For now, we'll just prepend a small hidden block if it's not a known binary type
    // or just return data as is for this POC.
    console.log(`Applying forensic watermark for ${transactionId} to ${filePath}`);

    return data;
}

/**
 * Decrypts a .bybx file (for server-side validation if needed)
 */
export const unwrapFile = (bybxBuffer, masterKey) => {
    const header = bybxBuffer.slice(0, 128);
    const iv = bybxBuffer.slice(128, 140);
    const tag = bybxBuffer.slice(140, 156);
    const encrypted = bybxBuffer.slice(156);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(masterKey, 'hex'), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};
