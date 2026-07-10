import { TabsList, TabsTrigger } from '@/components/ui/tabs';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', color: 'from-yellow-400 to-orange-500' },
  { id: 'logistics', label: 'Logistics', color: 'from-yellow-300 to-amber-500' },
  { id: 'withdrawals', label: 'Payouts', color: 'from-green-400 to-emerald-500' },
  { id: 'refunds', label: 'Refunds', color: 'from-red-400 to-rose-500' },
  { id: 'sellers', label: 'Sellers', color: 'from-blue-400 to-cyan-500' },
  { id: 'creators', label: 'Ambassadors', color: 'from-yellow-300 to-lime-500' },
  { id: 'buyers', label: 'Buyers', color: 'from-purple-400 to-indigo-500' },
  { id: 'clients', label: 'Clients', color: 'from-pink-400 to-fuchsia-500' }
];

export function AdminDashboardTabs() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-1 md:p-2 shadow-[0_18px_45px_rgba(17,17,17,0.08)] sticky top-4 z-40 overflow-hidden">
      <TabsList className="bg-transparent border-0 p-0 h-auto flex flex-nowrap overflow-x-auto no-scrollbar gap-1 md:gap-2">
        {ADMIN_TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={`flex-shrink-0 min-w-[100px] md:flex-1 rounded-xl px-4 md:px-6 py-2.5 md:py-3.5 text-xs md:text-sm font-semibold transition-all duration-300
            data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-sm
            data-[state=inactive]:text-stone-600 data-[state=inactive]:hover:text-black data-[state=inactive]:hover:bg-stone-100`}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}


