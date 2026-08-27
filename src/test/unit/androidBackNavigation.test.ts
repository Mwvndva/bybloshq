import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerModalDismiss,
  registerSubNavigation,
  dismissTopmostOverlay,
  handleSubNavigation,
  isAuthenticatedDashboardRoot
} from '@/shared/utils/modalBackHandler';

describe('Android Native Back Navigation Priorities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Priority 1: Modal / Drawer / Sheet Dismissal', () => {
    it('dismisses registered modal and stops navigation without popping route', () => {
      let modalClosed = false;
      const unregister = registerModalDismiss(() => {
        modalClosed = true;
        return true;
      });

      const dismissed = dismissTopmostOverlay();
      expect(dismissed).toBe(true);
      expect(modalClosed).toBe(true);

      // Subsequent call has nothing to dismiss
      const dismissedAgain = dismissTopmostOverlay();
      expect(dismissedAgain).toBe(false);

      unregister();
    });
  });

  describe('Priority 2: In-Memory Dashboard Sub-Navigation', () => {
    it('reverts non-root tab to overview when Android Back is triggered', () => {
      let activeTab = 'settings';
      const unregister = registerSubNavigation(() => {
        activeTab = 'overview';
        return true;
      });

      const handled = handleSubNavigation();
      expect(handled).toBe(true);
      expect(activeTab).toBe('overview');

      // Subsequent call falls through because sub-navigation was popped
      const handledAgain = handleSubNavigation();
      expect(handledAgain).toBe(false);

      unregister();
    });
  });

  describe('Priority 4: Authenticated Dashboard Root Detection', () => {
    it('correctly identifies authenticated dashboard roots for Buyer, Seller, Creator, and Mzigo', () => {
      expect(isAuthenticatedDashboardRoot('/buyer/dashboard')).toBe(true);
      expect(isAuthenticatedDashboardRoot('/buyer')).toBe(true);
      expect(isAuthenticatedDashboardRoot('/seller/dashboard')).toBe(true);
      expect(isAuthenticatedDashboardRoot('/seller')).toBe(true);
      expect(isAuthenticatedDashboardRoot('/creator/dashboard')).toBe(true);
      expect(isAuthenticatedDashboardRoot('/mzigo/dashboard')).toBe(true);
      expect(isAuthenticatedDashboardRoot('/logistics/dashboard')).toBe(true);
    });

    it('does NOT classify public homepage, public shop, or detail routes as dashboard roots', () => {
      expect(isAuthenticatedDashboardRoot('/')).toBe(false);
      expect(isAuthenticatedDashboardRoot('/shop/myshop')).toBe(false);
      expect(isAuthenticatedDashboardRoot('/buyer/shop/myshop')).toBe(false);
      expect(isAuthenticatedDashboardRoot('/buyer/orders')).toBe(false);
      expect(isAuthenticatedDashboardRoot('/legal')).toBe(false);
    });
  });
});
