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

        // 1. Convert product images (only image_url column exists)
        console.log('📦 Converting product images...');
        const { rows: products } = await client.query(
            `SELECT id, image_url FROM products 
       WHERE image_url LIKE 'data:image%'`
        );

        for (const product of products) {
            if (ImageService.isBase64Image(product.image_url)) {
                const shortUrl = await ImageService.base64ToFile(product.image_url, 'product');
                await client.query(
                    'UPDATE products SET image_url = $1 WHERE id = $2',
                    [shortUrl, product.id]
                );
                console.log(`  ✓ Converted product ${product.id} image`);
                totalConverted++;
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

        // 3. Convert event images
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
