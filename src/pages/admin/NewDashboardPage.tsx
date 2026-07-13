import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/features/auth/contexts';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Search, Calendar, Clock, Users, User, ShoppingCart, DollarSign, Activity, Store, UserPlus, Eye, MoreHorizontal, Loader2, Plus, Package, X, ShoppingBag, UserCheck, Box, UserCircle, MapPin, CheckCircle, XCircle, ArrowUpRight, Percent, TrendingUp, Lock, Unlock, Users2, Mail, Instagram, Facebook, Music2, Globe, Heart, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useGetBuyerByIdMutation, useDeleteUserMutation, useDeleteCreatorMutation, useUpdateBuyerStatusMutation, useGetSellerByIdMutation, useUpdateSellerStatusMutation, useUpdateWithdrawalRequestStatusMutation } from '@/hooks/admin/mutations/useAdminMutations';
import {
  useAdminAnalyticsQuery,
  useAdminSellersQuery,
  useAdminCreatorsQuery,
  useAdminBuyersQuery,
  useAdminWithdrawalsQuery,
  useAdminMonthlyMetricsQuery,
  useAdminFinancialsQuery,
  useAdminMonthlyFinancialDataQuery,
  useAdminDashboardStatsQuery,
  useAdminClientsQuery,
  useAdminBalancesQuery
} from '@/hooks/admin/queries/useAdminQueries';
import RefundRequestsPage from './RefundRequestsPage';
import { AdminEntityModals } from './components/AdminEntityModals';
import { AdminDashboardHeader } from './components/AdminDashboardHeader';
import { AdminDashboardTabs } from './components/AdminDashboardTabs';
import { AdminOverviewTab } from './components/AdminOverviewTab';
import { AdminLogisticsTab } from './components/AdminLogisticsTab';
import { AdminSellersTab } from './components/AdminSellersTab';
import { AdminCreatorsTab } from './components/AdminCreatorsTab';
import { AdminBuyersTab } from './components/AdminBuyersTab';
import { AdminWithdrawalsTab } from './components/AdminWithdrawalsTab';
import { AdminClientsTab } from './components/AdminClientsTab';
import { useAdminDashboard } from './useAdminDashboard';
import {
  StatsCard,
  type StatsCardProps
} from './components/AdminDashboardCharts';

// Custom tooltip for the events chart

import type { DashboardAnalytics, MonthlyMetricsData, WithdrawalRequest, FinancialMetrics, MonthlyFinancialData, DashboardState } from './adminDashboardTypes';

const NewAdminDashboard = () => {
  const {
    authLoading,
    isAuthenticated,
    isInitialized,
    error,
    retryDashboard,
    dashboardState,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    safeFormatDate,
    formatProviderBalance,
    providerHealth,
    providerHealthOk,
    providerHealthAvailable,
    pendingPayoutRequests,
    pendingPayoutAmount,
    inspectionSessionId,
    selectedSeller,
    isLoadingSeller,
    closeSellerModal,
    selectedBuyer,
    isLoadingBuyer,
    closeBuyerModal,
    handleViewSeller,
    handleDeleteUser,
    handleDeleteCreator,
    handleViewBuyer,
    handleWithdrawalRequestAction,
  } = useAdminDashboard();

  const navigate = useNavigate();

  const shouldShowTrend = (trend: number) => {
    return trend !== 0 || dashboardState.analytics.monthlyGrowth?.revenue !== 0;
  };

  const statsCards: StatsCardProps[] = [
    {
      title: 'Products',
      value: dashboardState.analytics.totalProducts.toLocaleString(),
      icon: <Package className="h-4 w-4 text-orange-500" />,
      description: `${dashboardState.analytics.lowStockProducts || 0} low stock`,
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.products ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.products ?? 0
        : null
    },
    {
      title: 'Sellers',
      value: dashboardState.analytics.totalSellers?.toLocaleString() || '0',
      icon: <ShoppingCart className="h-4 w-4 text-purple-500" />,
      description: 'Active sellers',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.sellers ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.sellers ?? 0
        : null
    },
    {
      title: 'Ambassadors',
      value: dashboardState.analytics.totalCreators?.toLocaleString() || '0',
      icon: <UserPlus className="h-4 w-4 text-yellow-500" />,
      description: `${dashboardState.analytics.pendingCreatorRequests || 0} pending requests`,
      trend: null
    },
    {
      title: 'Buyers',
      value: dashboardState.analytics.totalBuyers?.toLocaleString() || '0',
      icon: <UserCircle className="h-4 w-4 text-cyan-500" />,
      description: 'Registered buyers',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.buyers ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.buyers ?? 0
        : null
    },
    {
      title: 'Sales',
      value: `KSh ${dashboardState.financialMetrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-green-600" />,
      description: `${dashboardState.financialMetrics.totalOrders} orders`,
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.revenue ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.revenue ?? 0
        : null
    },
    {
      title: 'Commission',
      value: `KSh ${dashboardState.financialMetrics.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-yellow-600" />,
      description: 'Platform earnings',
      trend: shouldShowTrend(dashboardState.analytics.monthlyGrowth?.revenue ?? 0)
        ? dashboardState.analytics.monthlyGrowth?.revenue ?? 0
        : null
    },
    {
      title: 'Refunds',
      value: `KSh ${dashboardState.financialMetrics.totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4 text-red-600" />,
      description: `${dashboardState.financialMetrics.totalRefundRequests} completed`,
      trend: null
    },
    {
      title: 'Open Orders',
      value: dashboardState.analytics.activeOrders?.toLocaleString() || '0',
      icon: <Activity className="h-4 w-4 text-blue-500" />,
      description: 'Paid but not closed',
      trend: null
    },
    {
      title: 'Pending Payouts',
      value: dashboardState.analytics.pendingWithdrawals?.toLocaleString() || '0',
      icon: <Users className="h-4 w-4 text-blue-400" />,
      description: `${dashboardState.analytics.totalClients?.toLocaleString() || '0'} paying clients`,
      trend: null
    }
  ];


  if (authLoading || !isInitialized) {
    return (
      <div className="admin-light-dashboard flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[#f8f7f2]">
        <div className="flex flex-col items-center gap-4 rounded-full border border-stone-200 bg-white px-6 py-4 shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
          <Spinner className="h-12 w-12 text-yellow-500" />
          <p className="text-stone-600 font-semibold text-sm animate-pulse">Initializing admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/admin/login', { replace: true });
    return null;
  }

  if (error) {
    return (
      <div className="admin-light-dashboard flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[#f8f7f2] p-4 text-center sm:p-6">
        <div className="max-w-md space-y-6 rounded-3xl border border-stone-200 bg-white p-8 shadow-[0_18px_45px_rgba(17,17,17,0.08)]">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto border border-red-100">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-stone-950 tracking-tight">System error</h2>
            <p className="text-stone-600 font-medium">{error}</p>
          </div>
          <Button
            onClick={retryDashboard}
            className="w-full h-12 bg-yellow-400 text-black font-semibold rounded-2xl hover:bg-yellow-300 transition-all"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-light-dashboard min-h-[100svh] overflow-x-hidden bg-[#f8f7f2] text-stone-950 font-sans selection:bg-yellow-500/30 selection:text-black">
        <div className="mx-auto w-full max-w-[1760px] p-3 sm:p-5 md:p-8 lg:p-10 space-y-6 sm:space-y-8">
          <AdminDashboardHeader />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat) => (
              <StatsCard key={stat.title} {...stat} />
            ))}
          </div>

          {/* Navigation & Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <AdminDashboardTabs />

            <AdminEntityModals
              selectedSeller={selectedSeller as Record<string, unknown> | null}
              isLoadingSeller={isLoadingSeller}
              closeSellerModal={closeSellerModal}
              selectedBuyer={selectedBuyer as Record<string, unknown> | null}
              isLoadingBuyer={isLoadingBuyer}
              closeBuyerModal={closeBuyerModal}
              safeFormatDate={safeFormatDate}
              inspectionSessionId={inspectionSessionId}
            />
            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <AdminOverviewTab
                dashboardState={{
                  analytics: dashboardState.analytics as unknown as Record<string, unknown>,
                  topShops: dashboardState.topShops as Record<string, unknown>[],
                  sellers: dashboardState.sellers as unknown as Record<string, unknown>[],
                }}
                safeFormatDate={safeFormatDate}
                onShowSellers={() => setActiveTab('sellers')}
              />
            </TabsContent>

            {/* Sellers Tab */}
            <TabsContent value="sellers" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminSellersTab
                sellers={dashboardState.sellers}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onView={handleViewSeller}
                onDelete={handleDeleteUser}
              />
            </TabsContent>

            {/* Creators Tab */}
            <TabsContent value="creators" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminCreatorsTab
                creators={dashboardState.creators}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onDelete={handleDeleteCreator}
              />
            </TabsContent>

            {/* Buyers Tab */}
            <TabsContent value="buyers" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminBuyersTab
                buyers={dashboardState.buyers}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onView={handleViewBuyer}
                onDelete={handleDeleteUser}
                formatDate={safeFormatDate}
              />
            </TabsContent>

            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminWithdrawalsTab
                withdrawalRequests={dashboardState.withdrawalRequests}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeOrders={dashboardState.analytics.activeOrders}
                pendingPayoutCount={pendingPayoutRequests.length}
                pendingPayoutAmount={pendingPayoutAmount}
                providerHealth={providerHealth}
                providerHealthOk={providerHealthOk}
                providerHealthAvailable={providerHealthAvailable}
                formatProviderBalance={formatProviderBalance}
                formatDate={safeFormatDate}
                onAction={handleWithdrawalRequestAction}
              />
            </TabsContent>

            <TabsContent value="logistics" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminLogisticsTab />
            </TabsContent>

            {/* Refunds Tab */}
            <TabsContent value="refunds" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                <RefundRequestsPage />
              </div>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <AdminClientsTab
                clients={dashboardState.clients}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                formatDate={safeFormatDate}
              />
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
};

export default NewAdminDashboard;



