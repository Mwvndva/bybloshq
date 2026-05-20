import cacheService from '../services/cache.service.js';
import paymentService from '../services/payment.service.js';
import * as publicCatalogRepository from '../repositories/publicCatalog.repository.js';
import * as sellerRepository from '../repositories/seller.repository.js';
import * as publicOrderStatusRepository from '../repositories/publicOrderStatus.repository.js';
import { sanitizePublicProduct, sanitizePublicSeller } from '../shared/utils/sanitize.js';

const PUBLIC_PAYMENT_STATUS_SYNC_INTERVAL_MS = 15000;
const PAYMENT_SUCCESS_STATUSES = new Set(['completed', 'success', 'paid']);
const PAYMENT_FAILURE_STATUSES = new Set([
  'failed',
  'cancelled',
  'manual_review_required',
  'payment_mapping_failed',
  'compensation_required'
]);

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractPublicPaymentFailureReason(row) {
  const paymentMetadata = parseJson(row.payment_metadata);
  const orderMetadata = parseJson(row.order_metadata);
  return paymentMetadata.failure_reason
    || paymentMetadata.provider_payload?.gateway_response
    || paymentMetadata.provider_payload?.message
    || paymentMetadata.provider_payload?.display_text
    || paymentMetadata.completion_blocked?.provider_payload?.gateway_response
    || orderMetadata.payment_failure?.provider_status
    || orderMetadata.payment_failure?.source
    || null;
}

async function syncPendingPaymentFromProvider(row) {
  const paymentStatus = String(row.payment_record_status || row.payment_status || '').toLowerCase();
  if (!row.payment_id || paymentStatus !== 'pending') {
    return row;
  }

  const paymentMetadata = parseJson(row.payment_metadata);
  const lastCheckedAt = Date.parse(paymentMetadata.public_status_checked_at || '');
  if (Number.isFinite(lastCheckedAt) && Date.now() - lastCheckedAt < PUBLIC_PAYMENT_STATUS_SYNC_INTERVAL_MS) {
    return row;
  }

  const reference = row.provider_reference || row.api_ref;
  if (!reference) {
    return row;
  }

  await publicOrderStatusRepository.mergePaymentMetadata({
    paymentId: row.payment_id,
    metadataPatch: { public_status_checked_at: new Date().toISOString() }
  });

  try {
    const providerStatus = await paymentService.checkTransactionStatus(reference);
    const normalizedStatus = String(providerStatus.status || '').toLowerCase();

    if (PAYMENT_SUCCESS_STATUSES.has(normalizedStatus) || PAYMENT_FAILURE_STATUSES.has(normalizedStatus)) {
      const { default: CorePaymentService } = await import('../core/CorePaymentService.js');
      await CorePaymentService.completeVerifiedPayment({
        paymentId: row.payment_id,
        reference,
        providerPayload: {
          ...providerStatus,
          status: normalizedStatus
        },
        source: 'public_order_status_poll'
      });

      return await publicOrderStatusRepository.findStatusByIdentifier(row.order_number) || row;
    }

    await publicOrderStatusRepository.mergePaymentMetadata({
      paymentId: row.payment_id,
      metadataPatch: {
        public_status_provider_snapshot: {
          status: normalizedStatus || null,
          checked_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.warn('[PublicOrderStatus] Provider status sync failed:', error.message);
  }

  return await publicOrderStatusRepository.findStatusByIdentifier(row.order_number) || row;
}

// Get all products (public)
export const getProducts = async (req, res) => {
  try {
    const { aesthetic, city, location, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // 1. Generate Cache Key based on filters and pagination
    const cacheKey = `products:list:${aesthetic || 'all'}:${city || 'all'}:${location || 'all'}:${pageNum}:${limitNum}`;

    // 2. Try to get from Cache
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const rows = await publicCatalogRepository.findActiveProductsWithSeller({
      aesthetic, city, location, limit: limitNum, offset
    });
    const total = Number.parseInt(rows[0]?.total_count || 0, 10);

    // Transform results to use sanitization DTOs
    const sanitizedProducts = rows.map(row => {
      const product = sanitizePublicProduct(row);

      // Inject nested seller info (also sanitized)
      product.seller = sanitizePublicSeller({
        ...row,
        id: row.seller_id,
        shopName: row.seller_shop_name,
        city: row.seller_city,
        location: row.seller_location,
        physicalAddress: row.physical_address,
        avatarUrl: row.seller_avatar_url,
        bio: row.seller_bio,
        theme: row.seller_theme,
      });

      return product;
    });

    const responseData = {
      status: 'success',
      results: sanitizedProducts.length,
      pagination: {
        total,
        page: pageNum,
        pageSize: limitNum,
        hasMore: offset + sanitizedProducts.length < total
      },
      data: {
        products: sanitizedProducts,
        pagination: {
          total,
          page: pageNum,
          pageSize: limitNum,
          hasMore: offset + sanitizedProducts.length < total
        }
      }
    };

    // 3. Store in Cache (60 seconds)
    await cacheService.set(cacheKey, responseData, 60);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single product (public)
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await publicCatalogRepository.findProductByIdWithSeller(id);

    if (!row) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    const product = sanitizePublicProduct(row);
    product.seller = sanitizePublicSeller({
      ...row,
      shopName: row.shop_name,
      city: row.seller_city,
      location: row.seller_location,
      theme: row.seller_theme,
      physicalAddress: row.physical_address
    });

    res.status(200).json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    console.error(`Error fetching product ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all unique aesthetics
export const getAesthetics = async (req, res) => {
  try {
    const cacheKey = 'products:aesthetics';
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const aesthetics = await publicCatalogRepository.findDistinctAestheticsForAvailable();

    const responseData = {
      status: 'success',
      data: {
        aesthetics
      }
    };

    await cacheService.set(cacheKey, responseData, 600); // 10 mins cache

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching aesthetics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch aesthetics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get seller public info
export const getSellerPublicInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await sellerRepository.findPublicById(id);

    if (!seller) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        seller: sanitizePublicSeller(seller)
      }
    });
  } catch (error) {
    console.error(`Error fetching seller ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch seller information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all active sellers with wishlist count
export const getSellers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.limit || req.query.pageSize || '24', 10) || 24));
    const offset = (page - 1) * pageSize;
    const cacheKey = `public:sellers:list:${page}:${pageSize}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    const rows = await sellerRepository.findActiveWithStats({ limit: pageSize, offset });
    const total = parseInt(rows[0]?.total_count || '0', 10);

    const sellers = rows.map(row => ({
      id: row.id,
      shopName: row.shop_name,
      shopLink: row.shop_name, // Use shop_name as the link slug
      bannerUrl: row.banner_image, // Mapped from banner_image
      avatarUrl: row.avatar_url,
      bio: row.bio,
      theme: row.theme, // Mapped from theme
      physicalAddress: row.physical_address,
      hasPhysicalShop: Boolean(row.physical_address || (row.latitude && row.longitude)),
      latitude: row.latitude,
      longitude: row.longitude,
      clientCount: row.client_count || 0,
      totalWishlistCount: parseInt(row.total_wishlist_count, 10) || 0,
      wishlistCount: parseInt(row.total_wishlist_count, 10) || 0,
      knockCount: parseInt(row.knock_count, 10) || 0,
      createdAt: row.created_at
    }));

    const responseData = {
      status: 'success',
      results: sellers.length,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: offset + sellers.length < total
      },
      data: {
        sellers,
        pagination: {
          page,
          pageSize,
          total,
          hasMore: offset + sellers.length < total
        }
      }
    };

    await cacheService.set(cacheKey, responseData, 30);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sellers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const knockSeller = async (req, res) => {
  try {
    const sellerId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid seller ID is required'
      });
    }

    const result = await sellerRepository.recordKnockAndCount(sellerId);

    if (!result?.seller_exists) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        sellerId,
        knockCount: Number.parseInt(result.knock_count || '0', 10)
      }
    });
  } catch (error) {
    console.error('Error recording seller knock:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to record knock',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getServiceAvailability = async (req, res) => {
  try {
    const { productId } = req.params;
    const { date } = req.query; // e.g. ?date=2026-04-19

    if (!date) {
      return res.status(400).json({ status: 'error', message: 'Date parameter required' });
    }

    // Get all booked/reserved (non-expired) slots for this service on this date
    const rows = await publicCatalogRepository.findUnavailableServiceSlots({ productId, date });

    const unavailableSlots = rows
      .filter(r => r.is_unavailable)
      .map(r => r.time_slot);

    res.status(200).json({
      status: 'success',
      data: { unavailableSlots, date }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch availability' });
  }
};

export const getOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    let order = await publicOrderStatusRepository.findStatusByIdentifier(id);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    order = await syncPendingPaymentFromProvider(order);

    res.status(200).json({
      status: 'success',
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentRecordStatus: order.payment_record_status || null,
        failureReason: extractPublicPaymentFailureReason(order)
      }
    });
  } catch (error) {
    console.error(`Error fetching status for order ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch order status'
    });
  }
};
