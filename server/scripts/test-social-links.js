
import logger from '../utils/logger.js';

class WhatsAppServiceStub {
    formatSocialLinks(seller) {
        const links = [];
        if (seller.instagram_link) links.push(`📸 *Instagram:* ${seller.instagram_link}`);
        if (seller.tiktok_link) links.push(`🎵 *TikTok:* ${seller.tiktok_link}`);
        if (seller.facebook_link) links.push(`📘 *Facebook:* ${seller.facebook_link}`);

        if (links.length > 0) {
            return `\n\n🔗 *CONNECT WITH US:*\n${links.join('\n')}`;
        }
        return '';
    }
}

const service = new WhatsAppServiceStub();

const testSellers = [
    { name: 'No Links', instagram_link: null, tiktok_link: null, facebook_link: null },
    { name: 'Instagram Only', instagram_link: 'https://instagr.am/test', tiktok_link: null, facebook_link: null },
    { name: 'All Links', instagram_link: 'https://instagr.am/test', tiktok_link: 'https://tiktok.com/@test', facebook_link: 'https://fb.com/test' }
];

testSellers.forEach(seller => {
    console.log(`--- Testing: ${seller.name} ---`);
    const output = service.formatSocialLinks(seller);
    if (output) {
        console.log('Output:' + output);
    } else {
        console.log('Output: (empty)');
    }
});
