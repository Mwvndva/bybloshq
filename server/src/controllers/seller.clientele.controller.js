// Seller clientele handlers (buyer follow/unfollow a shop).
// Split from seller.controller.js in Phase 15.7b; re-exported via that barrel.
import { becomeClient, removeClient } from '../models/seller.model.js';

// @desc    Become a client of a seller
// @route   POST /api/buyers/sellers/:sellerId/become-client
// @access  Private (Buyer)
export const handleBecomeClient = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sellerId } = req.params;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (!sellerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Seller ID is required'
      });
    }

    const result = await becomeClient(sellerId, userId);

    res.status(200).json({
      status: 'success',
      success: true,
      message: result.alreadyClient ? 'You are already following this shop' : 'You are now following this shop',
      data: {
        clientCount: result.clientCount,
        alreadyClient: result.alreadyClient
      }
    });

  } catch (error) {
    console.error('Error becoming client:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to follow shop',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const handleLeaveClient = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sellerId } = req.params;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (!sellerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Seller ID is required'
      });
    }

    const result = await removeClient(sellerId, userId);

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'You have unfollowed this shop',
      data: {
        clientCount: result.clientCount,
        wasClient: result.wasClient
      }
    });

  } catch (error) {
    console.error('Error leaving clientele:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to unfollow shop',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
