import axios from 'axios';
import chalk from 'chalk';

const BASE_URL = 'http://localhost:3000/api';

const logResult = (name, passed, details = '') => {
    if (passed) {
        console.log(chalk.green(`[PASS] ${name}`));
    } else {
        console.log(chalk.red(`[FAIL] ${name} - ${details}`));
    }
};

async function testEndpoint(role, url, payload, expectedStatus) {
    try {
        await axios.post(`${BASE_URL}${url}`, payload);
        logResult(`${role} - Should have failed but succeeded`, false, `Got 200/201 instead of ${expectedStatus}`);
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data.message;
            if (status === expectedStatus) {
                logResult(`${role} - Got expected ${expectedStatus}`, true, message);
            } else {
                logResult(`${role} - Wrong Status`, false, `Expected ${expectedStatus}, got ${status}. Message: ${message}`);
            }
        } else {
            logResult(`${role} - Network Error`, false, error.message);
        }
    }
}

async function runTests() {
    console.log(chalk.blue.bold('=== TESTING LOGIN ERROR HANDLING ===\n'));

    // --- BUYER TESTS ---
    console.log(chalk.yellow('--- Buyer Login ---'));
    await testEndpoint('Buyer (Missing Fields)', '/buyers/login', {}, 400);
    await testEndpoint('Buyer (Invalid Creds)', '/buyers/login', { email: 'wrong@example.com', password: 'wrong' }, 401);

    // --- SELLER TESTS ---
    console.log(chalk.yellow('\n--- Seller Login ---'));
    await testEndpoint('Seller (Missing Fields)', '/sellers/login', {}, 400);
    await testEndpoint('Seller (User Not Found)', '/sellers/login', { email: 'nonexistent@example.com', password: 'password123' }, 401);
    // Note: If user exists but pass is wrong, we want to ensure it is ALSO 401 and generic message.
    // Assuming 'test@seller.com' might exist or not, but we test generic structure first.

    // --- ORGANIZER TESTS ---
    console.log(chalk.yellow('\n--- Organizer Login ---'));
    await testEndpoint('Organizer (Missing Fields)', '/organizers/login', {}, 400); // Middleware likely handles this
    await testEndpoint('Organizer (Invalid Creds)', '/organizers/login', { email: 'wrong@example.com', password: 'wrong' }, 401);

    console.log('\nDone.');
}

runTests();
