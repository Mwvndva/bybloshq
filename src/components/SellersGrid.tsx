import { useEffect, useState } from 'react';
import { publicApiService, Seller } from '@/api/publicApi';
import SellerBrandCard from '@/components/SellerBrandCard';

interface SellersGridProps {
    filterCity: string;
    filterArea: string;
    searchQuery: string;
    isBuyer?: boolean;
}

const SellersGrid = ({ filterCity, filterArea, searchQuery, isBuyer }: SellersGridProps) => {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        const fetchSellers = async (signal: AbortSignal) => {
            setLoading(true);
            try {
                const data = await publicApiService.getSellers();
                if (signal.aborted) return;
                setSellers(data);
            } catch (error: any) {
                if (error.name === 'AbortError') return;
                console.error('Failed to fetch sellers', error);
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        };

        fetchSellers(controller.signal);

        return () => controller.abort();
    }, []);

    const filteredSellers = sellers.filter(seller => {
        // City filter
        if (filterCity && seller.city !== filterCity) return false;
        // Area filter
        if (filterArea && seller.location !== filterArea) return false;
        // Search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                (seller.shopName || seller.shop_name || '').toLowerCase().includes(query) ||
                (seller.fullName || '').toLowerCase().includes(query)
            );
        }
        return true;
    });

    if (loading) {
        return <div className="text-white text-center py-10">Loading shops...</div>;
    }

    if (filteredSellers.length === 0) {
        return <div className="text-gray-400 text-center py-10">No shops found matching your criteria.</div>;
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSellers.map((seller) => (
                <SellerBrandCard key={seller.id} seller={seller} isBuyer={isBuyer} />
            ))}
        </div>
    );
};

export default SellersGrid;
