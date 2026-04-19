import React from 'react';
import { Users, Heart, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ShopCardProps {
    shop: any;
    onOpen: (shop: any) => void;
    featured?: boolean;
}

const SHOP_COLORS = [
    '#8B5CF6', '#EC4899', '#10B981', '#3B82F6',
    '#F59E0B', '#EF4444', '#06B6D4', '#F97316',
];

function getShopColor(name: string) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFFFF;
    return SHOP_COLORS[Math.abs(h) % SHOP_COLORS.length];
}

export function ShopCard({ shop, onOpen, featured = false }: ShopCardProps) {
    const color = getShopColor(shop.shopName || shop.name || '');
    const initial = (shop.shopName || shop.name || '?')[0].toUpperCase();

    if (featured) {
        return (
            <Card
                onClick={() => onOpen(shop)}
                className="group cursor-pointer h-16 overflow-hidden flex items-stretch border-white/5 hover:border-yellow-400/20 hover:bg-white/5 transition-all duration-300"
            >
                <div
                    className="w-16 flex-shrink-0 flex items-center justify-center"
                    style={{ background: `linear-gradient(145deg, ${color}22 0%, ${color}08 100%)` }}
                >
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2"
                        style={{ background: `${color}20`, borderColor: `${color}40`, color: color }}
                    >
                        {initial}
                    </div>
                </div>
                <div className="flex-1 px-4 flex flex-col justify-center min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{shop.shopName || shop.name}</h3>
                    <div className="flex items-center gap-3 text-[10px] text-white/40">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {shop.clientCount ?? 0}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {shop.wishlistCount ?? 0}</span>
                    </div>
                </div>
                <div className="px-4 flex items-center">
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
                </div>
            </Card>
        );
    }

    return (
        <Card className="unified-card group cursor-pointer border-white/5 hover:border-yellow-400/20 transition-all duration-300">
            <div
                className="h-20 flex items-center justify-center relative overflow-hidden"
                style={{ background: `linear-gradient(145deg, ${color}15 0%, ${color}05 100%)` }}
            >
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border-2 z-10"
                    style={{ background: `${color}10`, borderColor: `${color}30`, color: color }}
                >
                    {initial}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
            </div>
            <CardContent className="p-3 space-y-3">
                <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">{shop.shopName || shop.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                            <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {shop.clientCount ?? 0}</span>
                            <span className="flex items-center gap-1"><Heart className="h-2.5 w-2.5" /> {shop.wishlistCount ?? 0}</span>
                        </div>
                    </div>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpen(shop);
                    }}
                    className="w-full h-8 text-[10px] font-bold rounded-lg bg-white/5 border-white/5 hover:bg-yellow-400 hover:text-black transition-all"
                >
                    Open Shop
                </Button>
            </CardContent>
        </Card>
    );
}
