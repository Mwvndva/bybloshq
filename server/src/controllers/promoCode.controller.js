import PromoCode from '../models/promoCode.model.js';
import Event from '../models/event.model.js';
import logger from '../utils/logger.js';

class PromoCodeController {
  /**
   * Create a new promo code (Organizer only)
   */
  create = async (req, res) => {
    try {
      // Check if user is authenticated and is an organizer
      if (!req.user || req.user.userType !== 'organizer') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Organizer authentication required.'
        });
      }
      
      const organizerId = req.user.id;

      const {
        event_id,
        code,
        description,
        discount_type = 'percentage',
        discount_value,
        max_uses,
        min_purchase_amount = 0,
        valid_from,
        valid_until,
        is_active = true
      } = req.body;

      // Validate required fields
      if (!event_id || !code || !discount_value) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: event_id, code, and discount_value are required'
        });
      }

      // Verify event belongs to organizer
      const event = await Event.findById(event_id);
      if (!event || Number(event.organizer_id) !== Number(organizerId)) {
        return res.status(404).json({
          success: false,
          message: 'Event not found or you do not have permission to create promo codes for this event'
        });
      }

      // Validate discount value
      if (discount_type === 'percentage' && (discount_value <= 0 || discount_value > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount must be between 0 and 100'
        });
      }

      if (discount_type === 'fixed' && discount_value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Fixed discount must be greater than 0'
        });
      }

      // Check if code already exists for this event
      const existingCode = await PromoCode.findByCode(event_id, code);
      if (existingCode) {
        return res.status(409).json({
          success: false,
          message: 'A promo code with this code already exists for this event'
        });
      }

      // Create promo code
      const promoCode = await PromoCode.create({
        event_id,
        organizer_id: organizerId,
        code,
        description,
        discount_type,
        discount_value,
        max_uses: max_uses || null,
        min_purchase_amount,
        valid_from: valid_from ? new Date(valid_from) : new Date(),
        valid_until: valid_until ? new Date(valid_until) : null,
        is_active
      });

      logger.info(`Promo code created: ${code} for event ${event_id} by organizer ${organizerId}`);

      res.status(201).json({
        success: true,
        message: 'Promo code created successfully',
        data: { promoCode }
      });
    } catch (error) {
      logger.error('Error creating promo code:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create promo code'
      });
    }
  };

  /**
   * Get all promo codes for an event (Organizer only)
   */
  getByEvent = async (req, res) => {
    try {
      // Check if user is authenticated and is an organizer
      if (!req.user || req.user.userType !== 'organizer') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Organizer authentication required.'
        });
      }
      
      const organizerId = req.user.id;
      const { eventId } = req.params;

      // Verify event belongs to organizer
      const event = await Event.findById(eventId);
      if (!event || Number(event.organizer_id) !== Number(organizerId)) {
        return res.status(404).json({
          success: false,
          message: 'Event not found or you do not have permission to view promo codes for this event'
        });
      }

      const promoCodes = await PromoCode.findByEvent(eventId, organizerId);

      res.json({
        success: true,
        data: { promoCodes }
      });
    } catch (error) {
      logger.error('Error fetching promo codes:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch promo codes'
      });
    }
  };

  /**
   * Get all promo codes for an organizer
   */
  getByOrganizer = async (req, res) => {
    try {
      // Check if user is authenticated and is an organizer
      if (!req.user || req.user.userType !== 'organizer') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Organizer authentication required.'
        });
      }
      
      const organizerId = req.user.id;

      const promoCodes = await PromoCode.findByOrganizer(organizerId);

      res.json({
        success: true,
        data: { promoCodes }
      });
    } catch (error) {
      logger.error('Error fetching organizer promo codes:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch promo codes'
      });
    }
  };

  /**
   * Validate promo code (Public endpoint for ticket purchase)
   */
  validate = async (req, res) => {
    try {
      const { eventId, code, purchaseAmount = 0 } = req.body;

      if (!eventId || !code) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: eventId and code are required'
        });
      }

      const validation = await PromoCode.validateForUse(eventId, code, purchaseAmount);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          data: { valid: false }
        });
      }

      const { promoCode } = validation;

      res.json({
        success: true,
        message: 'Promo code is valid',
        data: {
          valid: true,
          promoCode: {
            id: promoCode.id,
            code: promoCode.code,
            discount_type: promoCode.discount_type,
            discount_value: promoCode.discount_value,
            description: promoCode.description
          }
        }
      });
    } catch (error) {
      logger.error('Error validating promo code:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to validate promo code'
      });
    }
  };

  /**
   * Update promo code (Organizer only)
   */
  update = async (req, res) => {
    try {
      // Check if user is authenticated and is an organizer
      if (!req.user || req.user.userType !== 'organizer') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Organizer authentication required.'
        });
      }
      
      const organizerId = req.user.id;
      const { id } = req.params;

      // Verify promo code belongs to organizer
      const existingPromoCode = await PromoCode.findById(id);
      if (!existingPromoCode || Number(existingPromoCode.organizer_id) !== Number(organizerId)) {
        return res.status(404).json({
          success: false,
          message: 'Promo code not found or you do not have permission to update it'
        });
      }

      const updates = req.body;

      // Validate discount value if provided
      if (updates.discount_value !== undefined) {
        const discountType = updates.discount_type || existingPromoCode.discount_type;
        if (discountType === 'percentage' && (updates.discount_value <= 0 || updates.discount_value > 100)) {
          return res.status(400).json({
            success: false,
            message: 'Percentage discount must be between 0 and 100'
          });
        }
        if (discountType === 'fixed' && updates.discount_value <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Fixed discount must be greater than 0'
          });
        }
      }

      // Check code uniqueness if code is being updated
      if (updates.code && updates.code !== existingPromoCode.code) {
        const existingCode = await PromoCode.findByCode(existingPromoCode.event_id, updates.code);
        if (existingCode && existingCode.id !== parseInt(id)) {
          return res.status(409).json({
            success: false,
            message: 'A promo code with this code already exists for this event'
          });
        }
      }

      const updatedPromoCode = await PromoCode.update(id, organizerId, updates);

      logger.info(`Promo code updated: ${id} by organizer ${organizerId}`);

      res.json({
        success: true,
        message: 'Promo code updated successfully',
        data: { promoCode: updatedPromoCode }
      });
    } catch (error) {
      logger.error('Error updating promo code:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update promo code'
      });
    }
  };

  /**
   * Delete promo code (Organizer only)
   */
  delete = async (req, res) => {
    try {
      // Check if user is authenticated and is an organizer
      if (!req.user || req.user.userType !== 'organizer') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Organizer authentication required.'
        });
      }
      
      const organizerId = req.user.id;
      const { id } = req.params;

      // Verify promo code belongs to organizer
      const existingPromoCode = await PromoCode.findById(id);
      if (!existingPromoCode || Number(existingPromoCode.organizer_id) !== Number(organizerId)) {
        return res.status(404).json({
          success: false,
          message: 'Promo code not found or you do not have permission to delete it'
        });
      }

      await PromoCode.delete(id, organizerId);

      logger.info(`Promo code deleted: ${id} by organizer ${organizerId}`);

      res.json({
        success: true,
        message: 'Promo code deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting promo code:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete promo code'
      });
    }
  };

  /**
   * Get promo code usage statistics (Organizer only)
   */
  getStats = async (req, res) => {
    try {
      // Check if user is authenticated and is an organizer
      if (!req.user || req.user.userType !== 'organizer') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Organizer authentication required.'
        });
      }
      
      const organizerId = req.user.id;
      const { id } = req.params;

      // Verify promo code belongs to organizer
      const promoCode = await PromoCode.findById(id);
      if (!promoCode || Number(promoCode.organizer_id) !== Number(organizerId)) {
        return res.status(404).json({
          success: false,
          message: 'Promo code not found or you do not have permission to view its stats'
        });
      }

      const stats = await PromoCode.getUsageStats(id);

      res.json({
        success: true,
        data: {
          promoCode: {
            id: promoCode.id,
            code: promoCode.code,
            used_count: promoCode.used_count,
            max_uses: promoCode.max_uses
          },
          usage: stats
        }
      });
    } catch (error) {
      logger.error('Error fetching promo code stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch promo code statistics'
      });
    }
  };
}

export default new PromoCodeController();

