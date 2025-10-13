import DashboardRepository from '../repositories/dashboard.repository.js';
import Event from '../models/event.model.js';
import { AppError } from '../utils/errorHandler.js';

const DashboardController = {
  // Get dashboard data
  async getDashboardData(req, res, next) {
    try {
      if (!req.user?.id) {
        throw new AppError('Authentication required', 401);
      }
      
      const organizerId = req.user.id;
      
      // Update stats first to ensure they're current
      await DashboardRepository.updateDashboardStats(organizerId);
      
      // Get all dashboard data in parallel
      const [stats, upcomingEvents, recentSales] = await Promise.all([
        DashboardRepository.getDashboardStats(organizerId),
        Event.findUpcomingByOrganizer(organizerId, 5),
        DashboardRepository.getRecentSales(organizerId)
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          stats: stats || {
            total_events: 0,
            upcoming_events: 0,
            past_events: 0,
            current_events: 0,
            total_tickets_sold: 0,
            total_revenue: '0',
            total_attendees: 0
          },
          recentEvents: upcomingEvents || [],
          recentSales: recentSales || []
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Record a new sale
  async recordSale(req, res, next) {
    try {
      if (!req.user?.id) {
        throw new AppError('Authentication required', 401);
      }

      const sale = await DashboardRepository.recordSale({
        ...req.body,
        organizer_id: req.user.id
      });

      res.status(201).json({
        status: 'success',
        data: sale
      });
    } catch (error) {
      next(error);
    }
  },

  // Update dashboard with new event
  async addRecentEvent(req, res, next) {
    try {
      if (!req.user?.id) {
        throw new AppError('Authentication required', 401);
      }

      await DashboardRepository.addRecentEvent(req.user.id);

      res.status(200).json({
        status: 'success',
        message: 'Dashboard stats updated with new event'
      });
    } catch (error) {
      next(error);
    }
  }
};

export default DashboardController;
