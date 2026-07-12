import { Search, Users2, Store, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface AdminClientsTabProps {
  clients: unknown[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  formatDate: (dateString: string | null | undefined) => string;
}

export const AdminClientsTab = ({ clients, searchQuery, onSearchChange, formatDate }: AdminClientsTabProps) => {
  const filtered = ((clients || []) as Array<Record<string, unknown>>).filter((c) =>
    String(c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(c.sellerName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
      <CardHeader className="p-5 md:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <CardTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter">Client Network</CardTitle>
          <CardDescription className="text-xs md:text-sm text-gray-400 font-medium">Global mapping of customers and their associated merchants</CardDescription>
        </div>
        <div className="relative group w-full md:w-auto">
          <div className="absolute -inset-0.5 bg-pink-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-pink-500 transition-colors" />
          <Input
            type="text"
            placeholder="Search relations..."
            className="pl-12 w-full md:w-[320px] lg:w-[400px] h-11 md:h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-2xl focus:border-pink-500/50 focus:ring-pink-500/10 transition-all font-medium text-sm"
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
                <th className="px-5 md:px-8 py-4 md:py-6">Customer Network Node</th>
                <th className="px-5 md:px-8 py-4 md:py-6 hidden md:table-cell">Associated Merchant</th>
                <th className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">Contact Protocol</th>
                <th className="px-5 md:px-8 py-4 md:py-6 text-right">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((client) => (
                <tr key={String(client.id)} className="hover:bg-white/[0.02] transition-all group">
                  <td className="px-5 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-pink-500/30 transition-all shadow-inner">
                        <Users2 className="w-4 h-4 md:w-5 md:h-5 text-gray-500 group-hover:text-pink-500 transition-all" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm md:text-base font-black text-white tracking-tight truncate">{String(client.name || '')}</p>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50 truncate">CID: {String(client.id).slice(0, 12)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 hidden md:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/5 flex items-center justify-center border border-yellow-500/10">
                        <Store className="w-3.5 h-3.5 text-yellow-500/50" />
                      </div>
                      <span className="text-sm font-bold text-gray-300 tracking-tight">{String(client.sellerName || '')}</span>
                    </div>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 hidden lg:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
                        <Mail className="w-3.5 h-3.5 text-blue-500/50" />
                      </div>
                      <span className="text-sm font-medium text-gray-400 italic lowercase">{String(client.email || '')}</span>
                    </div>
                  </td>
                  <td className="px-5 md:px-8 py-4 md:py-6 text-right">
                    <p className="text-[10px] md:text-sm font-bold text-gray-400 tabular-nums">{formatDate(client.createdAt as string)}</p>
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mt-0.5 hidden sm:block">First Seen</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
