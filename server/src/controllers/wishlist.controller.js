import * as wishlistRepository from '../repositories/wishlist.repository.js';

// Get the buyer's wishlist
export const getWishlist = async (req, res) => {
  try {
    // CROSS-ROLE FIX
    const buyerId = req.user.buyerProfileId || (req.user.userType === 'buyer' ? req.user.id : null);

    if (!buyerId) {
      // If no buyer profile, return empty wishlist instead of error (optional UX choice, but error is safer for API)
      return res.status(200).json({ success: true, data: { items: [] } });
    }

    const wishlist = await wishlistRepository.findByBuyerId(buyerId);

    // Return the data in the expected format
    res.status(200).json({
      success: true,
      data: {
        items: wishlist
      }
    });
  } catch (error) {
    console.error('Error in getWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wishlist',
      error: error.message
    });
  }
};

// Add a product to the buyer's wishlist
export const addToWishlist = async (req, res) => {
  try {
    // CROSS-ROLE FIX: Use buyerProfileId if available (for sellers acting as buyers), 
    // otherwise use req.user.id (if explicitly logged in as buyer)
    const buyerId = req.user.buyerProfileId || (req.user.userType === 'buyer' ? req.user.id : null);

    if (!buyerId) {
      return res.status(400).json({
        success: false,
        message: 'A valid buyer profile is required to use the wishlist.'
      });
    }

    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const wishlistItem = await wishlistRepository.add(buyerId, productId);

    res.status(201).json({
      success: true,
      data: wishlistItem,
      message: 'Product added to wishlist successfully'
    });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    if (error.code === '23505' || error.code === 'DUPLICATE_WISHLIST_ITEM') { // Unique violation or duplicate
      return res.status(409).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to add to wishlist',
      error: error.message
    });
  }
};

// Remove a product from the buyer's wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    // CROSS-ROLE FIX
    const buyerId = req.user.buyerProfileId || (req.user.userType === 'buyer' ? req.user.id : null);

    if (!buyerId) {
      return res.status(400).json({
        success: false,
        message: 'A valid buyer profile is required.'
      });
    }

    const { productId } = req.params;

    const deletedItem = await wishlistRepository.remove(buyerId, productId);

    if (deletedItem) {
      res.status(200).json({
        success: true,
        message: 'Product removed from wishlist successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Product not found in wishlist'
      });
    }
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from wishlist',
      error: error.message
    });
  }
};