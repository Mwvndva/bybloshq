import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type DashboardSection = 'shop' | 'shops' | 'wishlist' | 'orders';
type BuyerSection = DashboardSection | 'profile';

export function useBuyerActiveSection() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<BuyerSection>(() => {
    // Priority 1: Pathname (new standard for direct linking)
    const pathname = location.pathname;
    if (pathname.includes('/buyer/orders')) return 'orders';
    if (pathname.includes('/buyer/shops')) return 'shops';
    if (pathname.includes('/buyer/wishlist')) return 'wishlist';
    if (pathname.includes('/buyer/profile')) return 'shop';

    // Priority 2: Navigation state
    const stateSection = (location.state as Record<string, unknown>)?.activeSection as string | undefined;
    if (stateSection) return stateSection as BuyerSection;

    // Priority 3: Query parameters (legacy support)
    const queryParams = new URLSearchParams(location.search);
    const querySection = queryParams.get('section') || queryParams.get('tab');
    if (querySection === 'profile') return 'shop';
    if (querySection && ['shop', 'shops', 'wishlist', 'orders'].includes(querySection)) {
      return querySection as "shop" | "shops" | "wishlist" | "orders";
    }

    return 'shop';
  });
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);

  // Sync active section with URL changes
  useEffect(() => {
    const pathname = location.pathname;
    const queryParams = new URLSearchParams(location.search);
    const pathMapping: Record<string, typeof activeSection> = {
      '/buyer/orders': 'orders',
      '/buyer/shops': 'shops',
      '/buyer/wishlist': 'wishlist',
      '/buyer/profile': 'shop',
      '/buyer/dashboard': 'shop'
    };

    const targetSection = pathMapping[pathname];
    const shouldOpenProfileSidebar = pathname === '/buyer/profile'
      || queryParams.get('section') === 'profile'
      || queryParams.get('tab') === 'profile';

    if (shouldOpenProfileSidebar) {
      setIsProfileSidebarOpen(true);
    } else {
      setIsProfileSidebarOpen(false);
    }
    if (targetSection && targetSection !== activeSection) {
      setActiveSection(targetSection);
    }
  }, [location.pathname, location.search, activeSection]);

  return { activeSection, setActiveSection, isProfileSidebarOpen, setIsProfileSidebarOpen };
}
