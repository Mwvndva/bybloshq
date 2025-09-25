import http from 'http';

const data = JSON.stringify({
  reference: 'PROD-123456',
  status: 'completed',
  amount: '1500.00',
  currency: 'KES',
  invoice: {
    reference: 'INV-123456',
    amount: '1500.00',
    currency: 'KES',
    status: 'completed'
  },
  metadata: {
    paymentId: 'pay_123456',
    productId: 'prod_123',
    transactionId: 'txn_123456',
    requestId: 'test-12345',
    is_product_payment: true,
    product_quantity: 1
  },
  timestamp: new Date().toISOString()
});

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/product-payments/product-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'X-IntaSend-Signature': 'test-signature',
    'X-Request-ID': 'test-12345'
  }
};

console.log('Sending webhook to:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('Headers:', JSON.stringify(options.headers, null, 2));
console.log('Body:', data);

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
