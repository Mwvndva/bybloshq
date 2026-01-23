import { pool } from '../src/config/database.js';
import ImageService from '../src/services/image.service.js';

/**
 * Migration script to convert all base64 images in the database to file URLs
 */

async function convertBase64Images() {
    const client = await pool.connect();

    try {
        console.log('🚀 Starting base64 image conversion...\n');

        let totalConverted = 0;

        // 1. Convert product images
        console.log('📦 Converting product images...');
        const { rows: products } = await client.query(
            `SELECT id, image_url, images FROM products 
       WHERE image_url LIKE 'data:image%' OR images::text LIKE '%data:image%'`
        );

        for (const product of products) {
            const updates = {};

            // Convert main image_url
            if (product.image_url && ImageService.isBase64Image(product.image_url)) {
                updates.image_url = await ImageService.base64ToFile(product.image_url, 'product');
                console.log(`  ✓ Converted product ${product.id} main image`);
                totalConverted++;
            }

            // Convert images array
            if (product.images && Array.isArray(product.images)) {
                const convertedImages = [];
                for (const img of product.images) {
                    if (ImageService.isBase64Image(img)) {
                        convertedImages.push(await ImageService.base64ToFile(img, 'product'));
                        totalConverted++;
                    } else {
                        convertedImages.push(img);
                    }
                }
                if (convertedImages.length > 0) {
                    updates.images = JSON.stringify(convertedImages);
                    console.log(`  ✓ Converted product ${product.id} image array (${convertedImages.length} images)`);
                }
            }

            // Update database
            if (Object.keys(updates).length > 0) {
                const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
                await client.query(
                    `UPDATE products SET ${setClause} WHERE id = $${Object.keys(updates).length + 1}`,
                    [...Object.values(updates), product.id]
                );
            }
        }

        // 2. Convert seller banner images
        console.log('\n🏪 Converting seller banner images...');
        const { rows: sellers } = await client.query(
            `SELECT id, banner_image FROM sellers WHERE banner_image LIKE 'data:image%'`
        );

        for (const seller of sellers) {
            if (ImageService.isBase64Image(seller.banner_image)) {
                const shortUrl = await ImageService.base64ToFile(seller.banner_image, 'seller_banner');
                await client.query(
                    'UPDATE sellers SET banner_image = $1 WHERE id = $2',
                    [shortUrl, seller.id]
                );
                console.log(`  ✓ Converted seller ${seller.id} banner image`);
                totalConverted++;
            }
        }

        // 3. Convert event images (if events table has images)
        console.log('\n🎫 Converting event images...');
        const { rows: events } = await client.query(
            `SELECT id, image_url FROM events WHERE image_url LIKE 'data:image%'`
        );

        for (const event of events) {
            if (ImageService.isBase64Image(event.image_url)) {
                const shortUrl = await ImageService.base64ToFile(event.image_url, 'event');
                await client.query(
                    'UPDATE events SET image_url = $1 WHERE id = $2',
                    [shortUrl, event.id]
                );
                console.log(`  ✓ Converted event ${event.id} image`);
                totalConverted++;
            }
        }

        console.log(`\n✅ Conversion complete! Total images converted: ${totalConverted}`);

    } catch (error) {
        console.error('❌ Error during conversion:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the conversion
convertBase64Images()
    .then(() => {
        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
    });
