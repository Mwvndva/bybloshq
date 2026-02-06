import React from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    Wallet,
    CreditCard,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { PLATFORM_FEE_RATE } from '@/lib/constants';

interface AnalyticsData {
    totalRevenue: number;
    balance: number;
    pendingDebt: number;
    pendingDebtCount: number;
    // include other fields if necessary for future expansion
}

interface UnifiedAnalyticsHubProps {
    analytics: AnalyticsData;
    onWithdraw: () => void;
}

export const UnifiedAnalyticsHub: React.FC<UnifiedAnalyticsHubProps> = ({
    analytics,
    onWithdraw
}) => {
    // Calculate Net Revenue (Gross - Platform Fee)
    const calculateNetRevenue = () => {
        const gross = analytics.totalRevenue || 0;
        const fee = gross * PLATFORM_FEE_RATE;
        return gross - fee;
    };

    const netRevenue = calculateNetRevenue();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            // Reduced top/bottom padding container slightly on mobile
            className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[rgba(17,17,17,0.8)] backdrop-blur-[16px] shadow-2xl"
        >
            {/* Ambient Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-purple-500/5 to-emerald-500/5 opacity-50 pointer-events-none" />

            {/* Grid Layout: Changed to grid-cols-2 for mobile to show 2x2 */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 relative z-10">

                {/* Metric 1: Gross Revenue */}
                <div className="group relative p-3 sm:p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 lg:border-r border-r border-white/5 transition-all duration-300 hover:bg-white/5">
                    <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-500/10" />
                    </div>

                    <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="text-gray-400 text-[10px] sm:text-sm font-medium uppercase tracking-wider truncate">Gross Sales</h3>
                        <p className="text-lg sm:text-3xl lg:text-4xl font-black text-white tracking-tight truncate">
                            {formatCurrency(analytics.totalRevenue || 0)}
                        </p>
                    </div>

                    <div className="mt-2 sm:mt-4 flex items-center gap-1 sm:gap-2">
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[9px] sm:text-xs font-bold">
                            <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            Total Volume
                        </span>
                    </div>
                </div>

                {/* Metric 2: Net Revenue */}
                <div className="group relative p-3 sm:p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 lg:border-r border-white/5 transition-all duration-300 hover:bg-white/5">
                    <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="text-gray-400 text-[10px] sm:text-sm font-medium uppercase tracking-wider truncate">Net Revenue</h3>
                        <p className="text-lg sm:text-2xl lg:text-3xl font-black text-white/90 tracking-tight truncate">
                            {formatCurrency(netRevenue)}
                        </p>
                    </div>

                    <div className="mt-2 sm:mt-4">
                        <p className="text-[9px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-1.5">
                            <AlertCircle className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                            After {PLATFORM_FEE_RATE * 100}% Fee
                        </p>
                    </div>
                </div>

                {/* Metric 3: Available Balance */}
                <div className="group relative p-3 sm:p-6 md:p-8 flex flex-col justify-between border-r border-white/5 lg:border-r md:border-b-0 lg:border-r border-white/5 transition-all duration-300 hover:bg-white/5 bg-gradient-to-b from-transparent to-emerald-500/5 hover:to-emerald-500/10">
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div className="space-y-0.5 sm:space-y-1 relative z-10">
                        <div className="flex items-center justify-between">
                            <h3 className="text-emerald-400/80 text-[10px] sm:text-sm font-bold uppercase tracking-wider truncate">Balance</h3>
                            <Wallet className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-emerald-500/50" />
                        </div>
                        <p className="text-lg sm:text-3xl lg:text-4xl font-black text-white tracking-tight truncate">
                            {formatCurrency(analytics.balance || 0)}
                        </p>
                    </div>

                    <div className="mt-2 sm:mt-4 relative z-10">
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[9px] sm:text-xs font-bold">
                            <Wallet className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            Ready
                        </span>
                    </div>
                </div>

                {/* Metric 4: Pending Payments */}
                <div className="group relative p-3 sm:p-6 md:p-8 flex flex-col justify-between transition-all duration-300 hover:bg-white/5">
                    <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <CreditCard className="h-8 w-8 sm:h-12 sm:w-12 text-purple-500/10" />
                    </div>

                    <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="text-gray-400 text-[10px] sm:text-sm font-medium uppercase tracking-wider truncate">Pending</h3>
                        <div className="flex items-baseline gap-1 sm:gap-2">
                            <p className="text-lg sm:text-3xl lg:text-3xl font-black text-white tracking-tight truncate">
                                {formatCurrency(analytics.pendingDebt || 0)}
                            </p>
                        </div>
                    </div>

                    <div className="mt-2 sm:mt-4">
                        <p className="text-[9px] sm:text-sm font-medium text-gray-500 truncate">
                            {analytics.pendingDebtCount || 0} Orders
                        </p>
                        <div className="w-full h-1 sm:h-1.5 bg-white/5 rounded-full overflow-hidden mt-1 sm:mt-2">
                            <div
                                className="h-full bg-purple-500/50 rounded-full"
                                style={{ width: `${Math.min((analytics.pendingDebtCount / 10) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </motion.div>
    );
};
