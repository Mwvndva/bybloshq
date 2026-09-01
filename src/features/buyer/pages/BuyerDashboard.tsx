import { useState, useEffect, lazy, Suspense } from 'react';
import { useToast } from '@/shared/hooks/use-toast';

// Lazy load the OrdersSection component
const OrdersSection = lazy(() => import('@/features/orders/components/OrdersSectionContainer'));
import {
  Heart, User,
  Store, ShoppingBag, Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '@/features/buyer/hooks/useWishlist';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { BuyerProfile } from '@/features/auth/types/authTypes';
import WishlistSection from '../components/WishlistSection';
import SellersGrid from '@/features/shop/components/SellersGrid';
import { BuyerBottomNav } from '../components/dashboard/BuyerBottomNav';
import { BuyerDashboardHeader } from '../components/dashboard/BuyerDashboardHeader';
import { BuyerDashboardSearch } from '../components/dashboard/BuyerDashboardSearch';
import { BuyerProfileContent } from '../components/dashboard/BuyerProfileSheet';
import { NotificationList } from '@/features/notifications/components/NotificationList';
import { MembershipGate } from '@/features/membership/components/MembershipGate';
import { useSwipeTabs } from '@/shared/hooks/useSwipeTabs';
import { useBuyerActiveSection } from '../components/dashboard/hooks/useBuyerActiveSection';
import { useBuyerProfileForm } from '../components/dashboard/hooks/useBuyerProfileForm';
import { useBuyerOrdersNotification } from '../components/dashboard/hooks/useBuyerOrdersNotification';
import { useThemeScope } from '@/shared/hooks/useAppTheme';

import { LoadingScreen as RouteFallback } from '@/shared/components/LoadingScreen';

type DashboardSection = 'shop' | 'notifications' | 'wishlist' | 'orders';
type BuyerSection = DashboardSection | 'profile';

const SWIPE_SECTIONS = ['shop', 'wishlist', 'orders', 'notifications'] as const;

// Main dashboard component
function BuyerDashboard() {
  useThemeScope('buyer');
  const navigate = useNavigate();
  const { user: globalUser, logout, updateProfile } = useGlobalAuth();
  const user = globalUser?.role === 'buyer' ? globalUser.profile as BuyerProfile : null;
  const updateBuyerProfile = (updates: Partial<BuyerProfile>) => updateProfile(updates, 'buyer');
  const { wishlist } = useWishlist();
  const { toast } = useToast();
  const { activeSection } = useBuyerActiveSection();

  const [searchQuery, setSearchQuery] = useState('');
  const {
    isEditingProfile, setIsEditingProfile,
    mobilePayment, setMobilePayment,
    whatsappNumber, setWhatsappNumber,
    isSavingProfile, handleSaveProfile,
  } = useBuyerProfileForm();
  const { hasUnreadOrders, markOrdersViewed } = useBuyerOrdersNotification(!!user);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get refund amount from user - Parse as float to ensure it's a number
  const refundAmount = typeof (user as unknown as { refunds?: string | number })?.refunds === 'string'
    ? parseFloat((user as unknown as { refunds: string }).refunds)
    : ((user as unknown as { refunds?: number })?.refunds || 0);



  useEffect(() => {
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    document.body.style.cssText = 'margin: 0; padding: 0; background-color: var(--byblos-bg, #000000); overflow-x: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; background-color: var(--byblos-bg, #000000); overflow-x: hidden;';

    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
    };
  }, []);

  const navItems = [
    { key: 'shop', label: 'Shops', Icon: Store, path: '/buyer/dashboard' },
    { key: 'wishlist', label: 'Wishlist', Icon: Heart, path: '/buyer/wishlist' },
    { key: 'orders', label: 'Orders', Icon: ShoppingBag, path: '/buyer/orders', badge: hasUnreadOrders },
    { key: 'notifications', label: 'Alerts', Icon: Bell, path: '/buyer/notifications' },
    { key: 'profile', label: 'Profile', Icon: User, path: '/buyer/profile' },
  ] as const;

  const activeNav = activeSection;

  const setActiveTab = (key: BuyerSection) => {
    const pathMap = {
      shop: 'dashboard',
      notifications: 'notifications',
      orders: 'orders',
      wishlist: 'wishlist',
      profile: 'profile'
    };
    if (key !== 'profile') {
      setIsEditingProfile(false);
    }
    navigate(`/buyer/${pathMap[key]}`);
    if (key === 'orders') {
      markOrdersViewed();
    }
  };

  const {
    onTouchStart: handleDashboardTouchStart,
    onTouchEnd: handleDashboardTouchEnd,
    onTouchCancel: handleDashboardTouchCancel,
  } = useSwipeTabs({
    tabs: SWIPE_SECTIONS,
    activeTab: activeSection,
    onChange: setActiveTab,
    disabled: activeSection === 'profile',
  });


  return (
    <div className="page-enter dashboard-layout min-w-0 overflow-x-hidden bg-[var(--byblos-bg,#000000)] text-[var(--byblos-text,#ffffff)] transition-colors duration-200" style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100svh',
      height: '100svh',
      overflowY: 'hidden',
    }}>
      <BuyerDashboardHeader />

      {/* Dashboard Body: establishes positioning context for drawer and overlay immediately below header */}
      <div
        className="relative flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{
          marginBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <BuyerDashboardSearch
          activeSection={activeSection}
          productSearchQuery={searchQuery}
          onProductSearchChange={setSearchQuery}
        />

        {/* Main Content Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 'clamp(10px, 4vw, 18px)',
          paddingBottom: '1rem',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          overscrollBehavior: 'none',
        }}
          onTouchStart={handleDashboardTouchStart}
          onTouchEnd={handleDashboardTouchEnd}
          onTouchCancel={handleDashboardTouchCancel}
        >
          {activeSection === 'shop' && (
            <>
              <SellersGrid filterCity="" filterArea="" searchQuery={searchQuery} isBuyer={true} />
            </>
          )}

          {activeSection === 'notifications' && (
            <div className="mx-auto w-full max-w-[760px]">
              <NotificationList
                variant="default"
                scrollClassName=""
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] shadow-sm dark:shadow-[0_8px_25px_rgba(0,0,0,0.45)]"
              />
            </div>
          )}

          {activeSection === 'wishlist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">Wishlist</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-white/50">{wishlist.length} items</span>
              </div>
              <WishlistSection />
            </div>
          )}

          {activeSection === 'orders' && (
            <div className="space-y-4">
              <Suspense fallback={<RouteFallback message="Loading orders..." />}>
                <OrdersSection />
              </Suspense>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="mx-auto w-full max-w-[560px]">
              <BuyerProfileContent
                isEditingProfile={isEditingProfile}
                isSavingProfile={isSavingProfile}
                mobilePayment={mobilePayment}
                refundAmount={user?.refunds || 0}
                user={user}
                whatsappNumber={whatsappNumber}
                onLogout={handleLogout}
                onMobilePaymentChange={setMobilePayment}
                onSaveProfile={handleSaveProfile}
                onToggleEdit={() => setIsEditingProfile(!isEditingProfile)}
                onWhatsappNumberChange={setWhatsappNumber}
              />
            </div>
          )}
        </div>
      </div>

      <BuyerBottomNav activeNav={activeNav} navItems={navItems} onSelect={setActiveTab} />

      {/* First-login Byblos membership card opt-in + share */}
      <MembershipGate enabled={!!user} />
    </div>
  );
}

export default BuyerDashboard;


