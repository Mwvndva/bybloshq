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

export default router;
