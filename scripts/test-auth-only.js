import axios from 'axios';

async function testAuth() {
    const creds = {
        user: "mwxndx",
        pass: "ZqdjMJgS42cYacWwvg7k5XHbvA7jeWgL2qzcibe2",
        secret: "msWGWSWKvE0r5trZvfFIbxNvL35rDcQ6fM7q6B55"
    };

    console.log("Testing ALTERNATIVE Auth Headers...");

    const tests = [
        { name: "Bearer Token (Pass)", headers: { 'Authorization': `Bearer ${creds.pass}` } },
        { name: "Bearer Token (Secret)", headers: { 'Authorization': `Bearer ${creds.secret}` } },
        { name: "x-api-key (Pass)", headers: { 'x-api-key': creds.pass } },
        { name: "x-api-key (Secret)", headers: { 'x-api-key': creds.secret } },
        { name: "Api-Key (Pass)", headers: { 'Api-Key': creds.pass } },
        { name: "ApiKey (Pass)", headers: { 'ApiKey': creds.pass } },
        // Try User:Pass but with API Key as user
        { name: "Basic (Pass:Secret)", headers: { 'Authorization': `Basic ${Buffer.from(`${creds.pass}:${creds.secret}`).toString('base64')}` } },
    ];

    for (const t of tests) {
        process.stdout.write(`Testing [${t.name}]... `);
        try {
            await axios.get('https://api.mypayd.app/api/v3/networks/grouped?dial_code=254', {
                headers: t.headers
            });
            console.log('✅ SUCCESS!');
            console.log(`>>> WORKING HEADERS:`, t.headers);
            return;
        } catch (error) {
            console.log(`❌ Failed (${error.response?.status || error.message})`);
        }
    }
    console.log("All alternatives failed.");
}

testAuth();
