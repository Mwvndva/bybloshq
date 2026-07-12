import { Search, User, Calendar, Eye, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AdminBuyer } from '../adminDashboardTypes';

interface AdminBuyersTabProps {
  buyers: AdminBuyer[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onView: (buyerId: string) => void;
  onDelete: (userId: string | undefined, role: 'seller' | 'buyer') => void;
  formatDate: (dateString: string | null | undefined) => string;
}

export const AdminBuyersTab = ({ buyers, searchQuery, onSearchChange, onView, onDelete, formatDate }: AdminBuyersTabProps) => {
  const filtered = buyers?.filter((b) =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
      <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Engagement Database</CardTitle>
          <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Customer behavioral records and identity tracking</CardDescription>
        </div>
        <div className="relative group w-full md:w-auto">
          <div className="absolute -inset-0.5 bg-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-cyan-500 transition-colors" />
          <Input
            type="text"
            placeholder="Search intelligence..."
            className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-cyan-500/50 focus:ring-cyan-500/10 transition-all font-medium text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="px-5 md:px-8 py-4 md:py-6">Customer Profile</th>
                <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Contact Protocol</th>
                <th className="px-5 md:px-8 py-4 md:py-6 hidden xl:table-cell">Activation Point</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">Security</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((buyer) => (
                <tr key={buyer.id} className="hover:bg-white/[0.02] transition-all group">
                  <td className="px-5 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-cyan-500/30 transition-all shadow-inner">
                        <User className="w-4 h-4 md:w-6 md:h-6 text-gray-500 group-hover:text-cyan-500 transition-all" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm md:text-base font-black text-white tracking-tight truncate">{buyer.name}</p>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50 truncate">UID: {String(buyer.id).slice(0, 12)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 hidden lg:table-cell">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-gray-300">{buyer.email}</p>
                      <p className="text-xs text-gray-500 font-medium tabular-nums">{buyer.phone || 'DATA MISSING'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                        <Calendar className="h-4 w-4 text-gray-400" />
                      </div>
                      <span className="text-sm font-bold text-gray-300 tracking-tight">{formatDate(buyer.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-center hidden md:table-cell">
                    <Badge className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none ${buyer.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                      {buyer.status}
                    </Badge>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                    <div className="flex items-center justify-end gap-2 md:gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-cyan-500 hover:bg-cyan-500 hover:text-black font-black uppercase tracking-widest text-[9px] md:text-[10px] border transition-all"
                        onClick={() => onView(buyer.id)}
                      >
                        <Eye className="h-3 md:h-3.5 w-3 md:w-3.5" />
                        <span className="hidden sm:inline ml-2">Insights</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 md:h-10 px-3 md:px-4 rounded-xl border-white/10 bg-white/5 text-red-400 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest text-[9px] md:text-[10px] border transition-all"
                        onClick={() => onDelete(buyer.user_id, 'buyer')}
                      >
                        <XCircle className="h-3 md:h-3.5 w-3 md:w-3.5" />
                        <span className="hidden sm:inline ml-2">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CardFooter className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
          Total Users: <span className="text-white ml-2 tabular-nums">{buyers?.length || 0}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Prev</Button>
          <Button variant="ghost" disabled className="text-gray-600 hover:bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px]">Next</Button>
        </div>
      </CardFooter>
    </Card>
  );
};
