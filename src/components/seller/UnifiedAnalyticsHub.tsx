import React from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    Wallet,
    AlertCircle,
    Users,
    MousePointerClick,
    Heart
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface AnalyticsData {
    totalSales: number;
    totalRevenue: number;
    totalPayout?: number;
    balance: number;
    availableBalance?: number;
    pendingSettlementBalance?: number;
    clientCount: number;
    clickCount: number;
    wishlistCount: number;
}

interface UnifiedAnalyticsHubProps {
    analytics: AnalyticsData;
}

export const UnifiedAnalyticsHub: React.FC<UnifiedAnalyticsHubProps> = ({
    analytics
}) => {
    const availableBalance = analytics.availableBalance ?? analytics.balance ?? 0;
    const metrics = [
        {
            label: 'Sales',
            value: formatCurrency(analytics.totalSales || 0),
            helper: 'Total order value',
            icon: TrendingUp,
            tone: 'yellow'
        },
        {
            label: 'Revenue',
            value: formatCurrency(analytics.totalRevenue || 0),
            helper: 'After platform commission',
            icon: AlertCircle,
            tone: 'neutral'
        },
        {
            label: 'Balance',
            value: formatCurrency(availableBalance),
            helper: 'Available to withdraw',
            icon: Wallet,
            tone: 'green'
        },
        {
            label: 'Clients',
            value: (analytics.clientCount || 0).toLocaleString(),
            helper: 'People following your shop',
            icon: Users,
            tone: 'blue'
        },
        {
            label: 'Clicks',
            value: (analytics.clickCount || 0).toLocaleString(),
            helper: 'Shop link visits',
            icon: MousePointerClick,
            tone: 'purple'
        },
        {
            label: 'Wishlist',
            value: (analytics.wishlistCount || 0).toLocaleString(),
            helper: 'Saved products',
            icon: Heart,
            tone: 'rose'
        }
    ];

    const toneStyles = {
        yellow: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
        neutral: 'bg-white/10 text-white/70 border-white/20',
        green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        blue: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        purple: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
        rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    } as const;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {metrics.map(({ label, value, helper, icon: Icon, tone }, index) => (
                    <div
                        key={label}
                        className={`group min-h-[128px] p-4 sm:p-5 lg:p-6 flex flex-col justify-between border-white/10 transition-colors hover:bg-white/[0.06] ${index < metrics.length - 1 ? 'border-r' : ''} max-md:[&:nth-child(2n)]:border-r-0 max-md:[&:nth-child(-n+4)]:border-b md:max-xl:[&:nth-child(3n)]:border-r-0 md:max-xl:[&:nth-child(-n+3)]:border-b`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-[11px] sm:text-xs font-semibold text-white/60 tracking-wide">
                                    {label}
                                </h3>
                                <p className="mt-1 text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-white [overflow-wrap:anywhere]">
                                    {value}
                                </p>
                            </div>
                            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${toneStyles[tone as keyof typeof toneStyles]}`}>
                                <Icon className="h-4 w-4" />
                            </span>
                        </div>

                        <p className="mt-4 text-xs text-white/60 leading-snug">
                            {helper}
                        </p>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};


