// Mocking the checkOrigin logic from express.js
const checkOrigin = (allowedList, currentOrigin) => {
    if (allowedList.includes(currentOrigin)) return true;

    try {
        const url = new URL(currentOrigin);
        const hostname = url.hostname;
        const protocol = url.protocol;
        const port = url.port ? `:${url.port}` : '';

        if (hostname.startsWith('www.')) {
            const nonWwwOrigin = `${protocol}//${hostname.substring(4)}${port}`;
            if (allowedList.includes(nonWwwOrigin)) return true;
        } else {
            const wwwOrigin = `${protocol}//www.${hostname}${port}`;
            if (allowedList.includes(wwwOrigin)) return true;
        }
    } catch (e) {
        return false;
    }
    return false;
};

const allowedOrigins = [
    'https://bybloshq.space',
    'http://localhost:3000'
];

const tests = [
    { origin: 'https://bybloshq.space', expected: true },
    { origin: 'https://www.bybloshq.space', expected: true },
    { origin: 'http://localhost:3000', expected: true },
    { origin: 'http://www.localhost:3000', expected: true }, // Technically possible
    { origin: 'https://malicious.com', expected: false },
    { origin: 'https://bybloshq.space.other.com', expected: false }
];

console.log('--- CORS Origin Logic Test ---');
let allPassed = true;
tests.forEach(test => {
    const result = checkOrigin(allowedOrigins, test.origin);
    const passed = result === test.expected;
    console.log(`${passed ? '✅' : '❌'} Origin: ${test.origin.padEnd(30)} | Expected: ${test.expected} | Got: ${result}`);
    if (!passed) allPassed = false;
});

if (allPassed) {
    console.log('\n✨ All tests passed!');
} else {
    console.log('\n❌ Some tests failed.');
    process.exit(1);
}
