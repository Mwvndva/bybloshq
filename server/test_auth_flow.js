
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const BASE_URL = 'http://localhost:3002/api';

async function testAuth() {
    try {
        const email = `test${Date.now()}@example.com`;
        const password = 'Password123!';

        console.log(`1. Registering new buyer: ${email}`);
        const registerRes = await client.post(`${BASE_URL}/buyers/register`, {
            fullName: 'Test User',
            email,
            phone: `07${Math.floor(Math.random() * 100000000)}`,
            password,
            confirmPassword: password,
            city: 'Nairobi',
            location: 'Kilimani'
        });

        console.log('Register Status:', registerRes.status);
        console.log('Cookies in Jar:', jar.getCookiesSync(BASE_URL));

        if (registerRes.status === 201 || registerRes.status === 200) {
            console.log('2. Accessing Profile with Cookie...');
            const profileRes = await client.get(`${BASE_URL}/buyers/profile`);
            console.log('Profile Status:', profileRes.status);
            console.log('Profile Data:', profileRes.data.data.buyer.email);

            if (profileRes.data.data.buyer.email === email) {
                console.log('SUCCESS: Authenticated flow working correctly on Backend.');
            } else {
                console.log('FAILURE: Profile email mismatch.');
            }
        }

    } catch (error) {
        console.error('ERROR OCCURRED:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        } else {
            console.error('No response received');
        }
    }
}

testAuth();
