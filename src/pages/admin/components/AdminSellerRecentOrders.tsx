import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ShoppingBag, User } from 'lucide-react';
import type { SellerDetail } from './AdminSellerDetailModal';

interface AdminSellerRecentOrdersProps {
  recentOrders: SellerDetail['recentOrders'];
}

export function AdminSellerRecentOrders({ recentOrders }: AdminSellerRecentOrdersProps) {
  return (
                          <Card className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                            <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                                  <ShoppingBag className="h-5 w-5 text-yellow-500" />
                                </div>
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Operational Stream</h4>
                              </div>
                              <Badge className="bg-yellow-500 text-black font-black px-4 py-1.5 border-none text-[10px] tracking-widest">LIVE DATA FEED</Badge>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead className="bg-white/[0.03] text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                  <tr>
                                    <th className="px-8 py-6">ID Reference</th>
                                    <th className="px-8 py-6">End Consumer</th>
                                    <th className="px-8 py-6">Transaction Value</th>
                                    <th className="px-8 py-6">Operational Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {recentOrders?.map((order) => (
                                    <tr key={String(order.id)} className="text-sm hover:bg-white/[0.02] transition-colors group/row">
                                      <td className="px-8 py-6">
                                        <code className="text-yellow-500 font-bold bg-yellow-500/5 px-3 py-1.5 rounded-lg border border-yellow-500/10 text-[10px]">
                                          #{order.orderNumber || String(order.id).slice(0, 12).toUpperCase()}
                                        </code>
                                      </td>
                                      <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                          <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                            <User className="h-4 w-4 text-gray-400" />
                                          </div>
                                          <span className="text-white font-black tracking-tight">{order.buyerName}</span>
                                        </div>
                                      </td>
                                      <td className="px-8 py-6">
                                        <span className="text-white font-black italic text-lg tracking-tighter">KSh {order.totalAmount?.toLocaleString()}</span>
                                      </td>
                                      <td className="px-8 py-6">
                                        <Badge className={`
                                          ${order.status === 'COMPLETED' || order.status === 'DELIVERY_COMPLETE' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            order.status === 'CANCELLED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                              'bg-blue-500/10 text-blue-400 border-blue-500/20'} 
                                          font-black text-[10px] tracking-widest px-4 py-1.5 border
                                        `}>
                                          {order.status}
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))}
                                  {(!recentOrders || recentOrders.length === 0) && (
                                    <tr>
                                      <td colSpan={4} className="px-8 py-12 text-center text-gray-500 font-black uppercase tracking-widest text-xs opacity-50">
                                        No recent operational data found
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </Card>
  );
}
