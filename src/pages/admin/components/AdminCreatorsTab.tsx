import { Search, UserPlus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { AdminCreator } from '../adminDashboardTypes';

interface AdminCreatorsTabProps {
  creators: AdminCreator[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onDelete: (creatorId: string, creatorName?: string) => void;
}

export const AdminCreatorsTab = ({ creators, searchQuery, onSearchChange, onDelete }: AdminCreatorsTabProps) => {
  const filtered = creators.filter((creator) =>
    creator.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    creator.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
      <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Ambassadors</CardTitle>
          <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Shop links, clicks, and earnings</CardDescription>
        </div>
        <div className="relative group w-full md:w-auto">
          <div className="absolute -inset-0.5 bg-yellow-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-yellow-500 transition-colors" />
          <Input
            type="text"
            placeholder="Search ambassadors..."
            className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-yellow-500/50 focus:ring-yellow-500/10 transition-all font-medium text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </CardHeader>
      <div className="grid grid-cols-1 gap-3 border-b border-white/5 bg-white/[0.012] p-5 md:grid-cols-4 md:p-8">
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-200/70">Ambassadors</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{creators.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-lime-500/20 bg-lime-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-lime-200/70">Ambassador sales</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{creators.reduce((sum, creator) => sum + (Number(creator.totalSales) || 0), 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200/70">Link clicks</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{creators.reduce((sum, creator) => sum + (Number(creator.linkClicks) || 0), 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200/70">Ambassador earnings</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">KSh {creators.reduce((sum, creator) => sum + (Number(creator.totalIncome) || 0), 0).toLocaleString()}</p>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="px-5 md:px-8 py-4 md:py-6">Ambassador</th>
                <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Contact</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden xl:table-cell">Linked Shops</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Performance</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right">Earnings</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((creator) => (
                <tr key={creator.id} className="hover:bg-white/[0.02] transition-all group">
                  <td className="px-5 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-yellow-500/30 transition-all shadow-inner">
                        <UserPlus className="w-4 h-4 md:w-6 md:h-6 text-gray-500 group-hover:text-yellow-500 transition-all" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm md:text-base font-black text-white tracking-tight truncate">{creator.name}</p>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50 truncate">CID: {String(creator.id).slice(0, 12)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 hidden lg:table-cell">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-gray-300">{creator.email}</p>
                      <p className="text-xs text-gray-500 font-medium tabular-nums">{creator.whatsappNumber || creator.mpesaNumber || '—'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center hidden xl:table-cell">
                    <p className="text-lg font-black text-white tabular-nums">{creator.linkedShops}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">{creator.pendingRequests} pending</p>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                    <p className="text-sm font-black text-white tabular-nums">{creator.totalSales} sales</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">{creator.linkClicks} clicks</p>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                    <p className="text-sm md:text-lg font-black text-white tracking-tighter tabular-nums">KSh {creator.totalIncome.toLocaleString()}</p>
                    <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">Balance KSh {creator.balance.toLocaleString()}</p>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(creator.id, creator.name)}
                      className="h-10 w-10 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-100"
                      aria-label={`Delete ${creator.name || 'creator'} account`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CardFooter className="p-8 border-t border-white/5 bg-white/[0.01]">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
          Total ambassadors: <span className="text-white ml-2 tabular-nums">{creators.length}</span>
        </p>
      </CardFooter>
    </Card>
  );
};
