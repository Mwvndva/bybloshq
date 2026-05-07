import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { publicApiService, Seller } from '@/api/publicApi';
import SellerBrandCard from '@/components/SellerBrandCard';

interface SellersGridProps {
    filterCity: string;
    filterArea: string;
    searchQuery: string;
    isBuyer?: boolean;
}

const SELLERS_CACHE_TTL_MS = 5 * 60 * 1000;
const INITIAL_VISIBLE_SELLERS = 24;
const VISIBLE_SELLERS_STEP = 24;

let sellersCache: { data: Seller[]; timestamp: number } | null = null;
let sellersRequest: Promise<Seller[]> | null = null;

const hasFreshSellersCache = () =>
    Boolean(sellersCache && Date.now() - sellersCache.timestamp < SELLERS_CACHE_TTL_MS);

const getCachedSellers = async () => {
    if (hasFreshSellersCache()) {
        return sellersCache!.data;
    }

    if (!sellersRequest) {
        sellersRequest = publicApiService.getSellers()
            .then((data) => {
                sellersCache = { data, timestamp: Date.now() };
                return data;
            })
            .finally(() => {
                sellersRequest = null;
            });
    }

    return sellersRequest;
};

const SellerGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" aria-label="Loading shops">
        {Array.from({ length: 12 }).map((_, index) => (
            <div
                key={index}
                className="aspect-square overflow-hidden rounded-2xl bg-gray-900"
            >
                <div className="h-full w-full animate-pulse bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
            </div>
        ))}
    </div>
);

const SellersGrid = ({ filterCity, filterArea, searchQuery, isBuyer }: SellersGridProps) => {
    const [sellers, setSellers] = useState<Seller[]>(() => hasFreshSellersCache() ? sellersCache!.data : []);
    const [loading, setLoading] = useState(() => !hasFreshSellersCache());
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SELLERS);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    useEffect(() => {
        let cancelled = false;

        const fetchSellers = async () => {
            if (!hasFreshSellersCache()) {
                setLoading(true);
            }
            try {
                const data = await getCachedSellers();
                if (cancelled) return;
                setSellers(data);
            } catch (error: any) {
                if (cancelled) return;
                console.error('Failed to fetch sellers', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSellers();

        return () => {
            cancelled = true;
        };
    }, []);

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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
