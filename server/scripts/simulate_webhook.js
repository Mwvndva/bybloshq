import axios from 'axios';

const API_URL = 'http://localhost:3002/api/payments/webhook/payd';
const REFERENCE = 'REF-1767717299595';

const payload = {
    transaction_reference: REFERENCE,
    reference: REFERENCE,
    result_code: 200,
    status: 'SUCCESS',
    amount: 1.00,
    phone_number: '0111548797', // From logs
    remarks: 'Simulated successful payment'
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
