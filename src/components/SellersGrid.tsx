import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApiService, Seller } from '@/api/publicApi';
import SellerBrandCard from '@/components/SellerBrandCard';

interface SellersGridProps {
    filterCity: string;
    filterArea: string;
    searchQuery: string;
    isBuyer?: boolean;
}

const INITIAL_VISIBLE_SELLERS = 24;
const VISIBLE_SELLERS_STEP = 24;

const SellerGridSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" aria-label="Loading shops">
        {Array.from({ length: 12 }).map((_, index) => (
            <div
                key={index}
                className="h-[184px] overflow-hidden rounded-2xl border border-white/10 bg-[#111111] p-3"
            >
                <div className="mb-3 flex items-start gap-3">
                    <div className="h-14 w-14 animate-pulse rounded-2xl bg-white/10" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                        <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-white/5" />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <div className="h-12 animate-pulse rounded-xl bg-white/5" />
                    <div className="h-12 animate-pulse rounded-xl bg-white/5" />
                    <div className="h-12 animate-pulse rounded-xl bg-white/5" />
                </div>
                <div className="mt-3 h-9 animate-pulse rounded-xl bg-white/10" />
            </div>
        ))}
    </div>
);

const SellersGrid = ({ filterCity, filterArea, searchQuery, isBuyer }: SellersGridProps) => {
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SELLERS);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const sellersQuery = useQuery({
        queryKey: ['public-sellers', 1, 48],
        queryFn: () => publicApiService.getSellersPage({ page: 1, limit: 48 }),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });
    const sellers = sellersQuery.data?.sellers || [];
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
        return <div className="text-gray-400 text-center py-10">No shops found matching your criteria.</div>;
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleSellers.map((seller) => (
                    <SellerBrandCard key={seller.id} seller={seller} isBuyer={isBuyer} />
                ))}
            </div>

            {visibleCount < filteredSellers.length && (
                <div className="mt-4 flex justify-center">
                    <button
                        type="button"
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 active:scale-95"
                        onClick={() => setVisibleCount(count => count + VISIBLE_SELLERS_STEP)}
                    >
                        Show more shops
                    </button>
                </div>
            )}
        </>
    );
};

export default memo(SellersGrid);
