import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import DiscountCode from '../models/discountCode.model.js';
import Event from '../models/event.model.js';

class DiscountCodeController {
  // Create a new discount code
  async createDiscountCode(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        event_id,
        code,
        description,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount_amount,
        usage_limit,
        valid_from,
        valid_until
      } = req.body;

      // Verify that the organizer owns the event
      const event = await Event.findById(event_id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      if (event.organizer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only create discount codes for your own events'
        });
      }

      // Check if discount code already exists for this event
      const existingCode = await DiscountCode.findByCode(code);
      if (existingCode && existingCode.event_id === parseInt(event_id)) {
        return res.status(400).json({
          success: false,
          message: 'This discount code already exists for this event'
        });
      }

      const discountCode = await DiscountCode.create({
        event_id,
        code,
        description,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount_amount,
        usage_limit,
        valid_from,
        valid_until,
        created_by: req.user.id
      });

      logger.info(`Discount code created: ${code} for event ${event_id} by organizer ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Discount code created successfully',
        data: discountCode
      });

    } catch (error) {
      logger.error('Error creating discount code:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get all discount codes for an event
  async getEventDiscountCodes(req, res) {
    try {
      const { eventId } = req.params;

      // Verify that the organizer owns the event
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      if (event.organizer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only view discount codes for your own events'
        });
      }

      const discountCodes = await DiscountCode.getByEventId(eventId);

      res.status(200).json({
        success: true,
        data: discountCodes
      });

    } catch (error) {
      logger.error('Error fetching discount codes:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get a single discount code
  async getDiscountCode(req, res) {
    try {
      const { id } = req.params;

      const discountCode = await DiscountCode.findById(id);
      if (!discountCode) {
        return res.status(404).json({
          success: false,
          message: 'Discount code not found'
        });
      }

      // Verify that the organizer owns the event
      const event = await Event.findById(discountCode.event_id);
      if (!event || event.organizer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only view discount codes for your own events'
        });
      }

      // Get usage statistics
      const stats = await DiscountCode.getUsageStats(id);

      res.status(200).json({
        success: true,
        data: {
          ...discountCode,
          stats
        }
      });

    } catch (error) {
      logger.error('Error fetching discount code:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update a discount code
  async updateDiscountCode(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updates = req.body;

      const discountCode = await DiscountCode.findById(id);
      if (!discountCode) {
        return res.status(404).json({
          success: false,
          message: 'Discount code not found'
        });
      }

      // Verify that the organizer owns the event
      const event = await Event.findById(discountCode.event_id);
      if (!event || event.organizer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only update discount codes for your own events'
        });
      }

      const updatedDiscountCode = await DiscountCode.update(id, updates);

      logger.info(`Discount code ${discountCode.code} updated by organizer ${req.user.id}`);

      res.status(200).json({
        success: true,
        message: 'Discount code updated successfully',
        data: updatedDiscountCode
      });

    } catch (error) {
      logger.error('Error updating discount code:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Delete a discount code
  async deleteDiscountCode(req, res) {
    try {
      const { id } = req.params;

      const discountCode = await DiscountCode.findById(id);
      if (!discountCode) {
        return res.status(404).json({
          success: false,
          message: 'Discount code not found'
        });
      }

      // Verify that the organizer owns the event
      const event = await Event.findById(discountCode.event_id);
      if (!event || event.organizer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete discount codes for your own events'
        });
      }

      // Check if the discount code has been used
      if (discountCode.actual_usage_count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete discount code that has been used'
        });
      }

      await DiscountCode.delete(id, discountCode.event_id);

      logger.info(`Discount code ${discountCode.code} deleted by organizer ${req.user.id}`);

      res.status(200).json({
        success: true,
        message: 'Discount code deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting discount code:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Validate a discount code (public endpoint)
  async validateDiscountCode(req, res) {
    try {
      const { code, order_amount } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Discount code is required'
        });
      }

      const validation = await DiscountCode.validate(code, order_amount);

      res.status(200).json({
        success: true,
        data: validation
      });

    } catch (error) {
      logger.error('Error validating discount code:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Record discount code usage (called during ticket purchase)
  async recordDiscountUsage(req, res) {
    try {
      const { discount_code_id, ticket_id, order_id, discount_amount, customer_email } = req.body;

      // This should be called internally during ticket purchase
      const usage = await DiscountCode.recordUsage(
        discount_code_id,
        ticket_id,
        order_id,
        discount_amount,
        customer_email
      );

      logger.info(`Discount code usage recorded: ${discount_code_id} for ticket ${ticket_id}`);

      res.status(201).json({
        success: true,
        message: 'Discount usage recorded successfully',
        data: usage
      });

    } catch (error) {
      logger.error('Error recording discount usage:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default new DiscountCodeController();
