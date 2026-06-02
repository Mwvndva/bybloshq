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
        yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        neutral: 'bg-stone-100 text-stone-700 border-stone-200',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        blue: 'bg-sky-50 text-sky-700 border-sky-200',
        purple: 'bg-violet-50 text-violet-700 border-violet-200',
        rose: 'bg-rose-50 text-rose-700 border-rose-200'
    } as const;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_18px_50px_rgba(17,17,17,0.08)]"
        >
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {metrics.map(({ label, value, helper, icon: Icon, tone }, index) => (
                    <div
                        key={label}
                        className={`group min-h-[128px] p-4 sm:p-5 lg:p-6 flex flex-col justify-between border-stone-200 transition-colors hover:bg-stone-50 ${index < metrics.length - 1 ? 'border-r' : ''} max-md:[&:nth-child(2n)]:border-r-0 max-md:[&:nth-child(-n+4)]:border-b md:max-xl:[&:nth-child(3n)]:border-r-0 md:max-xl:[&:nth-child(-n+3)]:border-b`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-[11px] sm:text-xs font-semibold text-stone-500 tracking-wide">
                                    {label}
                                </h3>
                                <p className="mt-1 text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-stone-950 [overflow-wrap:anywhere]">
                                    {value}
                                </p>
                            </div>
                            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${toneStyles[tone as keyof typeof toneStyles]}`}>
                                <Icon className="h-4 w-4" />
                            </span>
                        </div>

                        <p className="mt-4 text-xs text-stone-500 leading-snug">
                            {helper}
                        </p>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
