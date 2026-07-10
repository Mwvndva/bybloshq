export const adminQueryKeys = {
  all: ['admin'] as const,
  profile: () => [...adminQueryKeys.all, 'profile'] as const,
  logistics: (status?: string, sort?: string) => [...adminQueryKeys.all, 'logistics', status || 'all', sort || 'priority'] as const,
  users: () => [...adminQueryKeys.all, 'users'] as const,
  withdrawals: () => [...adminQueryKeys.all, 'withdrawals'] as const,
  analytics: () => [...adminQueryKeys.all, 'analytics'] as const,
  sellers: () => [...adminQueryKeys.all, 'sellers'] as const,
  creators: () => [...adminQueryKeys.all, 'creators'] as const,
  buyers: () => [...adminQueryKeys.all, 'buyers'] as const,
  clients: () => [...adminQueryKeys.all, 'clients'] as const,
  financials: () => [...adminQueryKeys.all, 'financials'] as const,
  balances: () => [...adminQueryKeys.all, 'balances'] as const,
  dashboardStats: () => [...adminQueryKeys.all, 'dashboardStats'] as const,
  monthlyMetrics: () => [...adminQueryKeys.all, 'monthlyMetrics'] as const,
  monthlyFinancialData: () => [...adminQueryKeys.all, 'monthlyFinancialData'] as const,
  refunds: (status?: string) => [...adminQueryKeys.all, 'refunds', status || 'all'] as const,
};


