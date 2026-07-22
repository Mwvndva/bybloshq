import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { ApiPublicSeller } from '@/types/api/seller';
import SellerBrandCard from '@/components/SellerBrandCard';
import { usePublicSellersQuery } from '@/hooks/public/useShopQueries';

interface SellersGridProps {
    filterCity: string;
    filterArea: string;
    searchQuery: string;
    isBuyer?: boolean;
}

const INITIAL_VISIBLE_SELLERS = 24;
const VISIBLE_SELLERS_STEP = 24;

const SellerGridSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Loading shops">
        {Array.from({ length: 12 }).map((_, index) => (
            <div
                key={index}
                className="h-[184px] overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
            >
                <div className="mb-3 flex items-start gap-3">
                    <div className="h-14 w-14 animate-pulse rounded-2xl bg-[#232323]" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-[#232323]" />
                        <div className="h-3 w-full animate-pulse rounded bg-[#232323]" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-[#232323]" />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <div className="h-12 animate-pulse rounded-xl bg-[#232323]" />
                    <div className="h-12 animate-pulse rounded-xl bg-[#232323]" />
                    <div className="h-12 animate-pulse rounded-xl bg-[#232323]" />
                </div>
                <div className="mt-3 h-9 animate-pulse rounded-xl bg-[#232323]" />
            </div>
        ))}
    </div>
);

const EMPTY_SELLERS: ApiPublicSeller[] = [];

const SellersGrid = ({ filterCity, filterArea, searchQuery, isBuyer }: SellersGridProps) => {
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SELLERS);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const sellersQuery = usePublicSellersQuery({ page: 1, limit: 100 });
    const sellers = sellersQuery.data?.sellers || EMPTY_SELLERS;
    const loading = sellersQuery.isLoading;

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_SELLERS);
    }, [filterCity, filterArea, deferredSearchQuery]);

    const filteredSellers = useMemo(() => {
        const query = deferredSearchQuery.trim().toLowerCase();

        return sellers.filter(seller => {
            if (filterCity && seller.city !== filterCity) return false;
            if (filterArea && seller.location !== filterArea) return false;
            if (query) {
                return (
                    (seller.shopName || seller.shop_name || '').toLowerCase().includes(query) ||
                    (seller.fullName || '').toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [sellers, filterCity, filterArea, deferredSearchQuery]);

    const visibleSellers = useMemo(
        () => filteredSellers.slice(0, visibleCount),
        [filteredSellers, visibleCount]
    );

    if (loading) {
        return <SellerGridSkeleton />;
    }

    if (filteredSellers.length === 0) {
        return <div className="text-stone-500 text-center py-10">No shops found matching your criteria.</div>;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSellers.map((seller) => (
                <SellerBrandCard key={seller.id} seller={seller} isBuyer={isBuyer} />
            ))}
        </div>
    );
};

export default memo(SellersGrid);


