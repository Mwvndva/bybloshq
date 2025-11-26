import logger from '../utils/logger.js';

/**
 * Server-Sent Events (SSE) Service
 * Manages real-time connections for payment status updates
 */
class SSEService {
  constructor() {
    // Map of invoice_id -> Set of response objects (clients)
    this.clients = new Map();
  }

  /**
   * Subscribe a client to payment status updates for a specific invoice
   * @param {string} invoiceId - The invoice ID to subscribe to
   * @param {Express.Response} res - Express response object
   */
  subscribe(invoiceId, res) {
    if (!invoiceId) {
      logger.warn('SSE: Attempted to subscribe without invoice ID');
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    res.write(`: SSE connection established\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'connected', invoiceId })}\n\n`);

    // Initialize client set for this invoice if it doesn't exist
    if (!this.clients.has(invoiceId)) {
      this.clients.set(invoiceId, new Set());
    }

    // Add this client to the set
    this.clients.get(invoiceId).add(res);

    logger.info(`SSE: Client subscribed to invoice ${invoiceId}. Total clients: ${this.clients.get(invoiceId).size}`);

    // Handle client disconnect
    res.on('close', () => {
      this.unsubscribe(invoiceId, res);
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      if (!res.destroyed) {
        try {
          res.write(`: heartbeat\n\n`);
        } catch (error) {
          logger.warn('SSE: Error sending heartbeat, removing client:', error.message);
          clearInterval(heartbeat);
          this.unsubscribe(invoiceId, res);
        }
      } else {
        clearInterval(heartbeat);
        this.unsubscribe(invoiceId, res);
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Unsubscribe a client from payment status updates
   * @param {string} invoiceId - The invoice ID
   * @param {Express.Response} res - Express response object
   */
  unsubscribe(invoiceId, res) {
    if (!invoiceId || !this.clients.has(invoiceId)) {
      return;
    }

    const clients = this.clients.get(invoiceId);
    clients.delete(res);

    logger.info(`SSE: Client unsubscribed from invoice ${invoiceId}. Remaining clients: ${clients.size}`);

    // Clean up empty sets
    if (clients.size === 0) {
      this.clients.delete(invoiceId);
      logger.info(`SSE: Removed empty subscription set for invoice ${invoiceId}`);
    }
  }

  /**
   * Broadcast payment status update to all clients subscribed to an invoice
   * @param {string} invoiceId - The invoice ID
   * @param {Object} data - The payment status data to send
   */
  broadcast(invoiceId, data) {
    if (!invoiceId || !this.clients.has(invoiceId)) {
      logger.debug(`SSE: No clients subscribed to invoice ${invoiceId}`);
      return;
    }

    const clients = this.clients.get(invoiceId);
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const deadClients = [];

    logger.info(`SSE: Broadcasting to ${clients.size} client(s) for invoice ${invoiceId}`);

    clients.forEach((res) => {
      if (res.destroyed) {
        deadClients.push(res);
        return;
      }

      try {
        res.write(message);
      } catch (error) {
        logger.warn('SSE: Error broadcasting to client:', error.message);
        deadClients.push(res);
      }
    });

    // Clean up dead clients
    deadClients.forEach((res) => {
      this.unsubscribe(invoiceId, res);
    });
  }

  /**
   * Get the number of active connections for an invoice
   * @param {string} invoiceId - The invoice ID
   * @returns {number} Number of active connections
   */
  getConnectionCount(invoiceId) {
    return this.clients.has(invoiceId) ? this.clients.get(invoiceId).size : 0;
  }

  /**
   * Get total number of active connections across all invoices
   * @returns {number} Total number of active connections
   */
  getTotalConnections() {
    let total = 0;
    this.clients.forEach((clients) => {
      total += clients.size;
    });
    return total;
  }
}

// Export singleton instance
export default new SSEService();

