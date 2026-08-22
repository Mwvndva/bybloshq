import { Search, UserPlus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import type { AdminCreator } from '../types/dashboard';

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
          <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Creators</CardTitle>
          <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Shop links, clicks, and earnings</CardDescription>
        </div>
        <div className="relative group w-full md:w-auto">
          <div className="absolute -inset-0.5 bg-yellow-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-yellow-500 transition-colors" />
          <Input
            type="text"
            placeholder="Search creators..."
            className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-yellow-500/50 focus:ring-yellow-500/10 transition-all font-medium text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </CardHeader>
      <div className="grid grid-cols-1 gap-3 border-b border-white/5 bg-white/[0.012] p-5 md:grid-cols-4 md:p-8">
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-200/70">Creators</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{creators.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-lime-500/20 bg-lime-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-lime-200/70">Creator sales</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{creators.reduce((sum, creator) => sum + (Number(creator.totalSales) || 0), 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200/70">Link clicks</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">{creators.reduce((sum, creator) => sum + (Number(creator.linkClicks) || 0), 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200/70">Creator earnings</p>
          <p className="mt-3 text-2xl font-black text-white tabular-nums">KSh {creators.reduce((sum, creator) => sum + (Number(creator.totalIncome) || 0), 0).toLocaleString()}</p>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="px-5 md:px-8 py-4 md:py-6">Creator</th>
                <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Contact</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden xl:table-cell">Linked Shops</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Performance</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right">Earnings</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {filtered.map((creator) => (
                <tr key={creator.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 md:h-10 md:w-10 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center font-black text-yellow-500 text-xs md:text-sm uppercase group-hover:scale-105 transition-transform">
                        {creator.name?.[0] || 'C'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm md:text-base group-hover:text-yellow-400 transition-colors truncate">{creator.name || 'Unnamed'}</p>
                        <p className="text-xs text-gray-500 truncate">{creator.email || 'No email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">
                    <p className="text-sm font-semibold text-gray-300">{creator.mpesaNumber || '—'}</p>
                    <p className="text-xs text-gray-500">M-Pesa</p>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden xl:table-cell">
                    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 tabular-nums">
                      {creator.linkedShops || 0}
                    </span>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                    <p className="text-sm font-black text-white tabular-nums">{creator.totalSales || 0}</p>
                    <p className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Sales</p>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                    <p className="text-sm font-black text-emerald-400 tabular-nums">KSh {(Number(creator.totalIncome) || 0).toLocaleString()}</p>
                    <p className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Earned</p>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(creator.id, creator.name)}
                      className="h-8 md:h-9 px-2.5 md:px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-bold text-xs"
                    >
                      <Trash2 className="h-4 w-4 md:mr-1.5" />
                      <span className="hidden md:inline">Delete</span>
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
          Total creators: <span className="text-white ml-2 tabular-nums">{creators.length}</span>
        </p>
      </CardFooter>
    </Card>
  );
};
