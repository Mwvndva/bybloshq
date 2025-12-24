import axios from 'axios';

const API_URL = 'http://localhost:3000/api/payments/webhook/payd';

// Payload mimicking PAYD success webhook
const payload = {
    transaction_reference: 'OLC221613287eR', // From your recent log
    result_code: 200,
    status: 'SUCCESS',
    amount: 1,
    currency: 'KES',
    phone_number: '0111548797',
    transaction_date: new Date().toISOString(),
    payment_method: 'MPESA',
    sender_phone: '0111548797',
    remarks: 'Payment Processed Successfully'
};

async function simulate() {
    try {
        console.log(`Sending Mock Webhook to ${API_URL}...`);
        console.log('Payload:', payload);

        const response = await axios.post(API_URL, payload);

        console.log('\n✅ Server Response:', response.data);
    } catch (error) {
        console.error('\n❌ Error sending webhook:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

simulate();
