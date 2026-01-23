import https from 'https';
import axios from 'axios';

const PAYD_URL = 'https://api.mypayd.app/api/v3/payments'; // Assuming standard endpoint path
const BASE_URL = 'https://api.mypayd.app/api/v3';

console.log('--- Starting Connectivity Diagnosis for Payd ---');

async function testAxiosDefault() {
    console.log('\n[Test 1] Axios Default Config (Current Implementation)');
    try {
        const agent = new https.Agent({
            rejectUnauthorized: false,
            keepAlive: false
        });

        await axios.get(BASE_URL, {
            httpsAgent: agent,
            timeout: 5000
        });
        console.log('✅ Success: reachable (GET /)');
    } catch (e) {
        console.log(`❌ Failed: ${e.message}`);
        if (e.code) console.log(`   Code: ${e.code}`);
    }
}

async function testAxiosIPv4() {
    console.log('\n[Test 2] Axios with Forced IPv4 (family: 4)');
    try {
        const agent = new https.Agent({
            rejectUnauthorized: false,
            keepAlive: false,
            family: 4 // FORCE IPv4
        });

        // Just checking connectivity to base URL or usage endpoint
        await axios.get(BASE_URL, {
            httpsAgent: agent,
            timeout: 5000
        });
        console.log('✅ Success: reachable with IPv4');
    } catch (e) {
        console.log(`❌ Failed: ${e.message}`);
        if (e.code) console.log(`   Code: ${e.code}`);
    }
}

async function testAxiosGoogle() {
    console.log('\n[Control] Connectivity Check (Google.com)');
    try {
        await axios.get('https://google.com');
        console.log('✅ Internet seems working');
    } catch (e) {
        console.log('❌ Internet check failed');
    }
}

(async () => {
    await testAxiosGoogle();
    await testAxiosDefault();
    await testAxiosIPv4();
})();
