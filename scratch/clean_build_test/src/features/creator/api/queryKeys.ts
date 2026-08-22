export const creatorQueryKeys = {
  all: ['creator'] as const,
  dashboard: (period?: string) => [...creatorQueryKeys.all, 'dashboard', period || '30d'] as const,
  referrals: () => [...creatorQueryKeys.all, 'referrals'] as const,
  invite: (token: string) => [...creatorQueryKeys.all, 'invite', token] as const,
  profile: () => [...creatorQueryKeys.all, 'profile'] as const,
};


