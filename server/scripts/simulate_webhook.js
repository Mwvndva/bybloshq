import axios from 'axios';

const API_URL = 'http://localhost:3002/api/callbacks/payd';
const REFERENCE = 'REF-TEST-' + Date.now();

const payload = {
    correlator_id: REFERENCE, // Payd v3 style
    status: 'FAILED',
    status_description: 'Simulation: Insufficient funds',
    amount: 100.00,
    phone_number: '254712345678',
    timestamp: new Date().toISOString()
};

/*
  From payment.service.js handlePaydCallback:
  const reference = callbackData.transaction_reference || callbackData.transaction_id || callbackData.reference;
  const resultCode = callbackData.result_code;
  const status = callbackData.status; 
  
  Success if resultCode == 200 or status === 'SUCCESS'
*/

async function run() {
    try {
        console.log(`Sending webhook to ${API_URL}...`);
        console.log('Payload:', payload);

        const response = await axios.post(API_URL, payload);

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
    } catch (error) {
        console.error('Error sending webhook:', error.response ? error.response.data : error.message);
    }
}

run();
