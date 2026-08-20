import express from 'express';
import { pool } from '../../infrastructure/database/database.js';

const router = express.Router();

/**
 * @route GET /health
 * @description Health check endpoint for monitoring services
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Service Unavailable',
      database: 'disconnected',
      error: error.message
    });
  }
});

/**
 * @route GET /health/ready
 * @description Readiness probe endpoint for cloud load balancers and orchestrators
 * @access Public
 */
router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'ready',
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      message: 'Required dependency unavailable',
      database: 'disconnected',
    });
  }
});

export default router;

