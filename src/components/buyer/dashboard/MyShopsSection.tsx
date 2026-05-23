import SellerBrandCard from '@/components/SellerBrandCard';
import { BuyerShopCardSkeleton } from './BuyerShopCardSkeleton';
import { getShopId } from './buyerShopUtils';

interface MyShopsSectionProps {
  filteredCount: number;
  isLoadingShops: boolean;
  mobileTab: 'online' | 'physical';
  onClickCountChange: (shop: any, clickCount: number) => void;
  onMobileTabChange: (tab: 'online' | 'physical') => void;
  onUnfollowShop: (shop: any) => void;
  searchQuery: string;
  shopGroups: Array<{
    key: 'online' | 'physical';
    title: string;
    count: number;
    shops: any[];
    empty: string;
  }>;
  shopsCount: number;
  unfollowingShopId: string | null;
}

export function MyShopsSection({
  filteredCount,
  isLoadingShops,
  mobileTab,
  onClickCountChange,
  onMobileTabChange,
  onUnfollowShop,
  searchQuery,
  shopGroups,
  shopsCount,
  unfollowingShopId
}: MyShopsSectionProps) {
  return (
    <>
      <div style={{
        padding: '0 0 8px',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>My Shops</span>
        <span style={{ fontSize: 11, color: '#6f6a60' }}>{filteredCount} shops</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-stone-200 bg-white p-1 shadow-sm md:hidden">
        {shopGroups.map((group) => {
          const isActive = mobileTab === group.key;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => onMobileTabChange(group.key)}
              className="flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition"
              style={{
                background: isActive ? '#FACC15' : 'transparent',
                color: isActive ? '#000000' : '#6f6a60'
              }}
            >
              <span>{group.title}</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{
                  background: isActive ? 'rgba(0,0,0,0.12)' : '#f3f1ea',
                  color: isActive ? '#000000' : '#6f6a60'
                }}
              >
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        {shopGroups.map((group) => (
          <ShopsGroup
            key={group.key}
            filteredCount={filteredCount}
            group={group}
            isLoadingShops={isLoadingShops}
            onClickCountChange={onClickCountChange}
            onUnfollowShop={onUnfollowShop}
            skeletonKeyPrefix={group.key}
            unfollowingShopId={unfollowingShopId}
          />
        ))}
      </div>

      <div className="grid gap-3 md:hidden">
        {shopGroups.filter(group => group.key === mobileTab).map((group) => (
          <ShopsGroup
            key={group.key}
            filteredCount={filteredCount}
            group={group}
            isLoadingShops={isLoadingShops}
            onClickCountChange={onClickCountChange}
            onUnfollowShop={onUnfollowShop}
            skeletonKeyPrefix={`${group.key}-mobile`}
            unfollowingShopId={unfollowingShopId}
          />
        ))}
      </div>

      {filteredCount === 0 && !isLoadingShops && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6f6a60' }}>
          {searchQuery ? 'No followed shops match your search.' : shopsCount === 0 ? 'No shops followed yet.' : 'No followed shops match your search.'}
        </div>
      )}
    </>
  );
}

interface ShopsGroupProps {
  filteredCount: number;
  group: {
    key: 'online' | 'physical';
    title: string;
    count: number;
    shops: any[];
    empty: string;
  };
  isLoadingShops: boolean;
  onClickCountChange: (shop: any, clickCount: number) => void;
  onUnfollowShop: (shop: any) => void;
  skeletonKeyPrefix: string;
  unfollowingShopId: string | null;
}

function ShopsGroup({
  filteredCount,
  group,
  isLoadingShops,
  onClickCountChange,
  onUnfollowShop,
  skeletonKeyPrefix,
  unfollowingShopId
}: ShopsGroupProps) {
  return (
    <section className="min-w-0 rounded-2xl border border-stone-200 bg-white p-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold text-stone-950">{group.title}</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
          {group.count}
        </span>
      </div>

      <div className="grid gap-3">
        {isLoadingShops && group.shops.length === 0 && Array.from({ length: 3 }).map((_, index) => (
          <BuyerShopCardSkeleton key={`${skeletonKeyPrefix}-skeleton-${index}`} />
        ))}

        {!isLoadingShops && group.shops.map(shop => (
          <SellerBrandCard
            key={getShopId(shop)}
            seller={shop}
            isBuyer
            showUnfollow
            onUnfollow={onUnfollowShop}
            onClickCountChange={onClickCountChange}
            isUnfollowing={unfollowingShopId === getShopId(shop)}
          />
        ))}

        {!isLoadingShops && filteredCount > 0 && group.shops.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-8 text-center text-xs text-stone-600">
            {group.empty}
          </div>
        )}
      </div>
    </section>
  );
}
