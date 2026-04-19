import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Admin from '../models/admin.model.js';
import Seller from '../models/seller.model.js';
import Product from '../models/product.model.js';
import Wishlist from '../models/wishlist.model.js';
import ClientModel from '../models/client.model.js';
import User from '../models/user.model.js';
import Order from '../models/order.model.js';
import Payout from '../models/payout.model.js';
import Withdrawal from '../models/withdrawal.model.js';
import Buyer from '../models/buyer.model.js';

class AdminService {
  async getDashboardStats() {
    try {
      return await Admin.getDashboardStats();
    } catch (e) {
      logger.error('Failed to fetch dashboard stats:', e);
      return {
        totalSellers: 0,
        totalBuyers: 0,
        totalClients: 0,
        totalShops: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalWishlists: 0,
        topShops: []
      };
    }
  }

  async getAnalytics() {
    try {
      return await Admin.getAnalytics();
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      return {
        userGrowth: [],
        revenueTrends: [],
        salesTrends: [],
        productStatus: [],
        geoDistribution: []
      };
    }
  }

  async getAllSellers() {
    return await Seller.findAll();
  }

  async getSellerById(id) {
    const seller = await Seller.findById(id);
    if (!seller) return null;

    const [metrics, totalProducts, wishlistCount, recentOrders] = await Promise.all([
      Seller.getMetrics(id),
      Product.getCountBySellerId(id),
      Wishlist.getCountBySellerId(id),
      Order.findRecentBySellerId(id, 5)
    ]);

    return {
      ...seller,
      metrics: {
        totalOrders: parseInt(metrics.total_orders, 10),
        totalSales: parseFloat(metrics.total_sales),
        totalCommission: parseFloat(metrics.total_commission),
        netSales: parseFloat(metrics.net_sales),
        pendingOrders: parseInt(metrics.pending_orders, 10),
        completedOrders: parseInt(metrics.completed_orders, 10),
        cancelledOrders: parseInt(metrics.cancelled_orders, 10),
        totalProducts,
        wishlistCount
      },
      recentOrders
    };
  }

  async updateSellerStatus(id, status) {
    return await Seller.updateStatus(id, status);
  }

  async getAllClients() {
    return await ClientModel.findAll();
  }

  async deleteUser(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Identify user role and profiles
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const { buyer_id: buyerId, seller_id: sellerId } = await User.findCrossRoles(userId);

      if (user.role === 'seller' || sellerId) {
        const sId = sellerId || (await Seller.findByUserId(userId))?.id;
        if (sId) {
          // Delete dependencies via models
          await Payout.deleteBySellerId(client, sId);
          await Withdrawal.deleteBySellerId(client, sId);
          await Seller.deleteSellerJunction(client, sId);
          await ClientModel.deleteBySellerId(client, sId);

          const sOrderIds = await Order.deleteBySellerId(client, sId);
          if (sOrderIds.length > 0) {
            await Order.deleteItemsByOrderIds(client, sOrderIds);
          }

          await Wishlist.deleteBySellerId(client, sId);
          await Product.deleteBySellerId(client, sId);
          await Seller.delete(client, sId);
        }
      }

      // --- Universal cleanup: runs for ALL roles ---

      // Decrement client count for affected sellers
      const affectedSellerIds = await Seller.findSellersByClientUserId(client, userId);
      if (affectedSellerIds.length > 0) {
        await Seller.decrementClientCount(client, affectedSellerIds);
      }
      await Seller.deleteClientJunction(client, userId);

      const bId = buyerId || (await Buyer.findByUserId(userId))?.id;
      if (bId) {
        await Wishlist.deleteByBuyerId(client, bId);
        const bOrderIds = await Order.deleteByBuyerId(client, bId);
        if (bOrderIds.length > 0) {
          await Order.deleteItemsByOrderIds(client, bOrderIds);
        }
        await Buyer.delete(client, bId);
      }

      // Now safe to delete the user row
      await User.delete(client, userId);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting user ${userId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new AdminService();

