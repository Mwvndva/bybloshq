#!/usr/bin/env node

// Simple test script to debug routing issues
import express from 'express';
import cors from 'cors';

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/buyers/orders', (req, res) => {
  console.log('🧪 TEST ROUTE HIT!');
  console.log('Request:', req.method, req.path);
  console.log('Headers:', req.headers);
  res.json({
    success: true,
    message: 'Test route working',
    data: [],
    timestamp: new Date().toISOString()
  });
});

// Start test server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Test the route with: curl http://localhost:3001/api/buyers/orders');
});
