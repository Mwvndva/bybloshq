import ProductService from '../src/services/product.service.js';
import path from 'path';

/**
 * Script to verify digital product path sanitization and security
 */
async function runSecurityTests() {
    console.log('🛡️ Starting Digital Pipeline Security Verification...\n');

    const testCases = [
        {
            name: 'Standard filename',
            input: 'my-ebook.pdf',
            expected: 'uploads/digital_products/my-ebook.pdf'
        },
        {
            name: 'Subdirectory attempt',
            input: 'books/ebook.pdf',
            expected: 'uploads/digital_products/ebook.pdf' // Should strip 'books/'
        },
        {
            name: 'Directory traversal (dot-dot)',
            input: '../../.env',
            expected: 'uploads/digital_products/.env' // Should strip '../'
        },
        {
            name: 'Absolute path attempt',
            input: '/etc/passwd',
            expected: 'uploads/digital_products/passwd' // Should strip leading slash and keep basename
        },
        {
            name: 'Windows style traversal',
            input: '..\\..\\config.json',
            expected: 'uploads/digital_products/config.json'
        }
    ];

    let passed = 0;
    for (const test of testCases) {
        try {
            // We use the static helper directly to test logic without DB
            const result = ProductService._sanitizeDigitalPath(test.input);

            if (result === test.expected) {
                console.log(`✅ PASSED: ${test.name}`);
                passed++;
            } else {
                console.log(`❌ FAILED: ${test.name}`);
                console.log(`   Input   : ${test.input}`);
                console.log(`   Expected: ${test.expected}`);
                console.log(`   Actual  : ${result}`);
            }
        } catch (error) {
            console.log(`❌ ERROR: ${test.name} - ${error.message}`);
        }
    }

    console.log(`\n📊 Summary: ${passed}/${testCases.length} tests passed.`);

    if (passed === testCases.length) {
        console.log('\n✨ Security hardening verified successfully!');
        process.exit(0);
    } else {
        console.log('\n⚠️ Security verification found issues.');
        process.exit(1);
    }
}

runSecurityTests().catch(err => {
    console.error('Fatal error in security tests:', err);
    process.exit(1);
});
