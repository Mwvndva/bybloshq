import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type DashboardSection = 'shop' | 'notifications' | 'wishlist' | 'orders';
type BuyerSection = DashboardSection | 'profile';

function sectionFromLocation(pathname: string, search: string): BuyerSection {
  if (pathname.includes('/buyer/orders')) return 'orders';
  if (pathname.includes('/buyer/notifications')) return 'notifications';
  if (pathname.includes('/buyer/wishlist')) return 'wishlist';
  if (pathname.includes('/buyer/profile')) return 'profile';

  const queryParams = new URLSearchParams(search);
  const querySection = queryParams.get('section') || queryParams.get('tab');
  if (querySection && ['shop', 'notifications', 'wishlist', 'orders', 'profile'].includes(querySection)) {
    return querySection as BuyerSection;
  }
  return 'shop';
}

export function useBuyerActiveSection() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<BuyerSection>(
    () => sectionFromLocation(location.pathname, location.search),
  );

  // Keep the active section in sync with the URL (direct links, back/forward).
  useEffect(() => {
    const target = sectionFromLocation(location.pathname, location.search);
    setActiveSection((prev) => (target !== prev ? target : prev));
  }, [location.pathname, location.search]);

  return { activeSection, setActiveSection };
}
