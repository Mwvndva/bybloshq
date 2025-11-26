import axios from 'axios';
import api from '@/lib/api';

// Ensure API_URL ends with /api but doesn't have a trailing slash
const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const API_URL = getApiBaseUrl();

// Types
export interface PromoCode {
  id: number;
  event_id: number;
  organizer_id: number;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses?: number | null;
  used_count: number;
  min_purchase_amount: number;
  valid_from: string;
  valid_until?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  event_name?: string;
  event_start_date?: string;
}

export interface PromoCodeCreateData {
  event_id: number;
  code: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value: number;
  max_uses?: number | null;
  min_purchase_amount?: number;
  valid_from?: string;
  valid_until?: string | null;
  is_active?: boolean;
}

export interface PromoCodeUpdateData {
  code?: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  max_uses?: number | null;
  min_purchase_amount?: number;
  valid_from?: string;
  valid_until?: string | null;
  is_active?: boolean;
}

export interface PromoCodeValidation {
  valid: boolean;
  promoCode?: {
    id: number;
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    description?: string;
  };
  error?: string;
}

export interface PromoCodeStats {
  total_uses: number;
  total_discount_given: number;
  total_original_revenue: number;
  total_final_revenue: number;
}

/**
 * Create a new promo code (Organizer only)
 */
export const createPromoCode = async (data: PromoCodeCreateData): Promise<PromoCode> => {
  const response = await api.post('/promo-codes', data);
  return response.data.data.promoCode;
};

/**
 * Get all promo codes for an organizer
 */
export const getOrganizerPromoCodes = async (): Promise<PromoCode[]> => {
  const response = await api.get('/promo-codes/organizer');
  return response.data.data.promoCodes;
};

/**
 * Get promo codes for a specific event
 */
export const getEventPromoCodes = async (eventId: number): Promise<PromoCode[]> => {
  const response = await api.get(`/promo-codes/event/${eventId}`);
  return response.data.data.promoCodes;
};

/**
 * Validate a promo code (Public endpoint)
 */
export const validatePromoCode = async (
  eventId: number,
  code: string,
  purchaseAmount: number = 0
): Promise<PromoCodeValidation> => {
  try {
    const response = await axios.post(`${API_URL}/promo-codes/validate`, {
      eventId,
      code,
      purchaseAmount
    });
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      return {
        valid: false,
        error: error.response.data.message || 'Invalid promo code'
      };
    }
    throw error;
  }
};

/**
 * Update a promo code (Organizer only)
 */
export const updatePromoCode = async (
  id: number,
  data: PromoCodeUpdateData
): Promise<PromoCode> => {
  const response = await api.patch(`/promo-codes/${id}`, data);
  return response.data.data.promoCode;
};

/**
 * Delete a promo code (Organizer only)
 */
export const deletePromoCode = async (id: number): Promise<void> => {
  await api.delete(`/promo-codes/${id}`);
};

/**
 * Get promo code usage statistics (Organizer only)
 */
export const getPromoCodeStats = async (id: number): Promise<{
  promoCode: {
    id: number;
    code: string;
    used_count: number;
    max_uses?: number | null;
  };
  usage: PromoCodeStats;
}> => {
  const response = await api.get(`/promo-codes/${id}/stats`);
  return response.data.data;
};

/**
 * Calculate discount amount from promo code
 */
export const calculateDiscount = (promoCode: PromoCode, originalPrice: number): number => {
  if (promoCode.discount_type === 'percentage') {
    const discount = (originalPrice * promoCode.discount_value) / 100;
    return Math.round(discount * 100) / 100;
  } else {
    return Math.min(promoCode.discount_value, originalPrice);
  }
};

