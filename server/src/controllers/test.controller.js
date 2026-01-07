import { Router } from 'express';

const router = Router();

// Public test endpoint
router.get('/webhook-test', (req, res) => {
  console.log('Webhook test endpoint hit');
  res.json({
    success: true,
    message: 'Webhook test successful',
    timestamp: new Date().toISOString()
  });
});

import { pool } from '../config/database.js';

router.get('/latest-withdrawal', async (req, res) => {
  try {
    const { rows } = await pool.query(`
            SELECT id, status, provider_reference, raw_response, created_at 
            FROM withdrawal_requests 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
    res.json(rows[0] || { message: 'No withdrawals found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
