import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import {
  Activity,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Facebook,
  Globe,
  Heart,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Music2,
  Package,
  Percent,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  User,
  UserCircle,
  Users2,
  X,
} from 'lucide-react';

interface AdminEntityModalsProps {
  selectedSeller: Record<string, unknown> | null;
  isLoadingSeller: boolean;
  closeSellerModal: () => void;
  selectedBuyer: Record<string, unknown> | null;
  isLoadingBuyer: boolean;
  closeBuyerModal: () => void;
  safeFormatDate: (dateString: string | null | undefined, formatStr?: string) => string;
  inspectionSessionId: string;
}

export function AdminEntityModals({
  selectedSeller,
  isLoadingSeller,
  closeSellerModal,
  selectedBuyer,
  isLoadingBuyer,
  closeBuyerModal,
  safeFormatDate,
  inspectionSessionId,
}: AdminEntityModalsProps) {
  return (
    <>
            {/* Modals Layer */}
            <div className="z-[100]">
              {/* Seller Details Modal */}
              {selectedSeller && (
                <div
                  className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300 overflow-hidden z-[100]"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="seller-modal-title"
                >
                  <div className="bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[2.5rem] w-full max-w-6xl max-h-[95dvh] flex flex-col shadow-[0_0_50px_rgba(245,158,11,0.1)] scale-in-95 duration-300">
                    <div className="flex items-center justify-between p-5 md:p-8 border-b border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-inner">
                          <Store className="h-7 w-7 text-yellow-500" />
                        </div>
                        <div>
                          <h3 id="seller-modal-title" className="text-2xl font-black text-white tracking-tight">{selectedSeller.shop_name || selectedSeller.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-yellow-500/10 text-yellow-500 border-none px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">Verified Merchant</Badge>
                            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              Joined {selectedSeller.created_at ? format(new Date(selectedSeller.created_at), 'MMMM dd, yyyy') : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button onClick={closeSellerModal} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group">
                        <X className="h-5 w-5 md:h-6 md:w-6 text-gray-400 group-hover:text-white group-hover:rotate-90 transition-all" />
                      </button>
                    </div>
                    <div className="overflow-auto flex-1 p-5 md:p-8 custom-scrollbar space-y-6 md:space-y-8">
                      {isLoadingSeller ? (
                        <div className="flex flex-col items-center justify-center h-60 space-y-4">
                          <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
                          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Accessing Encrypted Data...</p>
                        </div>
                      ) : (
                        <>
                          {selectedSeller.banner_image && (
                            <div className="w-full h-32 md:h-48 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-white/10 mb-8 relative group">
                              <img src={selectedSeller.banner_image} alt={`${selectedSeller.shop_name || selectedSeller.name} branding`} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-700" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
                              <div className="absolute bottom-4 left-6 flex items-end gap-5">
                                {selectedSeller.avatar_url && (
                                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-[1.5rem] border-2 border-white/10 overflow-hidden shadow-2xl bg-[#0A0A0A]">
                                    <img src={selectedSeller.avatar_url} alt={`${selectedSeller.shop_name || selectedSeller.name} profile`} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="mb-2">
                                  <Badge className="bg-yellow-500 text-black font-black text-[9px] tracking-widest px-3 py-1 mb-2">OFFICIAL STORE</Badge>
                                  <h4 className="text-xl font-black text-white tracking-tighter">{selectedSeller.shop_name}</h4>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            {/* Section 1: Core Identity */}
                            <Card className="bg-white/[0.02] border border-white/10 rounded-2xl md:rounded-[2rem] p-5 md:p-6 shadow-2xl">
                              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <UserCircle className="h-4 w-4 text-yellow-500" />
                                Merchant Identity
                              </h4>
                              <div className="space-y-4">
                                {[
                                  { label: 'Full Legal Name', value: selectedSeller.name, icon: <User className="h-3.5 w-3.5" /> },
                                  { label: 'Email Protocol', value: selectedSeller.email, icon: <Mail className="h-3.5 w-3.5" /> },
                                  { label: 'Secure Line', value: selectedSeller.phone, icon: <Activity className="h-3.5 w-3.5" /> },
                                  { label: 'Operating Hub', value: `${selectedSeller.city}${selectedSeller.location ? `, ${selectedSeller.location}` : ''}`, icon: <MapPin className="h-3.5 w-3.5" /> },
                                  { label: 'Merchant Balance', value: `KSh ${parseFloat(selectedSeller.balance || 0).toLocaleString()}`, highlight: true, icon: <DollarSign className="h-3.5 w-3.5" /> }
                                ].map((item, i) => (
                                  <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 group/item">
                                    <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                      <span className="opacity-40 group-hover/item:opacity-100 transition-opacity">{item.icon}</span>
                                      {item.label}
                                    </span>
                                    <span className={`text-sm font-bold ${(item as Record<string, unknown>).highlight ? 'text-yellow-500' : 'text-gray-200'}`}>{item.value || 'N/A'}</span>
                                  </div>
                                ))}
                              </div>
                            </Card>

                            {/* Section 2: Marketplace Profile */}
                            <Card className="bg-white/[0.02] border border-white/10 rounded-2xl md:rounded-[2rem] p-5 md:p-6 shadow-2xl">
                              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Globe className="h-4 w-4 text-blue-500" />
                                Digital Presence
                              </h4>
                              <div className="space-y-4">
                                <div className="space-y-3">
                                  <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <Globe className="h-3.5 w-3.5 opacity-40" />
                                    Public Shop Link
                                  </span>
                                  <a
                                    href={`https://bybloshq.space/${selectedSeller.slug || selectedSeller.shop_name?.toLowerCase()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 rounded-xl bg-white/5 border border-white/10 text-blue-400 font-bold text-xs truncate hover:bg-blue-500/10 hover:border-blue-500/20 transition-all flex items-center justify-between group/link"
                                  >
                                    /{selectedSeller.slug || selectedSeller.shop_name?.toLowerCase()}
                                    <ArrowUpRight className="h-4 w-4 opacity-0 group-hover/link:opacity-100 transition-all" />
                                  </a>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-2">
                                  {[
                                    { link: selectedSeller.instagram_link, icon: <Instagram className="h-5 w-5" />, color: 'hover:text-pink-500', label: 'Instagram' },
                                    { link: selectedSeller.facebook_link, icon: <Facebook className="h-5 w-5" />, color: 'hover:text-blue-600', label: 'Facebook' },
                                    { link: selectedSeller.tiktok_link, icon: <Music2 className="h-5 w-5" />, color: 'hover:text-white', label: 'TikTok' }
                                  ].map((social, i) => (
                                    <a
                                      key={i}
                                      href={social.link ? (social.link.startsWith('http') ? social.link : `https://${social.link}`) : '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transition-all ${social.link ? `text-gray-400 ${social.color} hover:bg-white/10` : 'text-gray-700 cursor-not-allowed opacity-30 hover:bg-transparent'}`}
                                      title={social.label}
                                    >
                                      {social.icon}
                                    </a>
                                  ))}
                                </div>
                                <div className="pt-2">
                                  <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest block mb-2">Merchant Bio</span>
                                  <p className="text-xs text-gray-400 leading-relaxed font-medium bg-white/5 rounded-xl p-3 border border-white/5 min-h-[60px]">
                                    {selectedSeller.bio || 'Enterprise-grade merchant specializing in premium logistics and high-quality products.'}
                                  </p>
                                </div>
                              </div>
                            </Card>

                            {/* Section 3: Engagement Metrics */}
                            <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
                              <Card className="bg-white/[0.02] border border-white/10 rounded-2xl md:rounded-[2rem] p-5 md:p-6 shadow-2xl flex flex-col justify-between">
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-purple-500" />
                                  Growth & Engagement
                                </h4>
                                <div className="flex-1 flex flex-col justify-center gap-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                        <Users2 className="h-5 w-5 text-purple-500" />
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Clients</p>
                                        <p className="text-2xl font-black text-white">{selectedSeller.client_count || 0}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                                        <Heart className="h-5 w-5 text-pink-500" />
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Wishlist Hits</p>
                                        <p className="text-2xl font-black text-white">{selectedSeller.metrics?.wishlistCount || 0}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                        <Package className="h-5 w-5 text-blue-500" />
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Inventory</p>
                                        <p className="text-2xl font-black text-white">{selectedSeller.metrics?.totalProducts || 0}</p>
                                      </div>
                                    </div>
                                    <div className="h-10 w-32 bg-white/5 rounded-full border border-white/10 flex items-center justify-center">
                                      <Badge className="bg-transparent text-gray-400 font-bold border-none">Active Fleet</Badge>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            </div>

                            {/* Section 4: Performance Analytics */}
                            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                { label: 'Total Volume', value: selectedSeller.metrics?.totalSales, color: 'text-green-400', icon: <DollarSign className="h-4 w-4" /> },
                                { label: 'Platform Revenue', value: selectedSeller.metrics?.totalCommission, color: 'text-yellow-400', icon: <Percent className="h-4 w-4" /> },
                                { label: 'Merchant Net', value: selectedSeller.metrics?.netSales, color: 'text-blue-400', icon: <TrendingUp className="h-4 w-4" /> },
                                { label: 'Order Chain', value: selectedSeller.metrics?.totalOrders, color: 'text-purple-400', icon: <ShoppingCart className="h-4 w-4" />, noCurrency: true }
                              ].map((met, i) => (
                                <div key={i} className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/[0.05] transition-all group/met">
                                  <div className={`h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center ${met.color} mb-3 shadow-inner group-hover/met:scale-110 transition-transform`}>{met.icon}</div>
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{met.label}</p>
                                  <p className={`text-xl font-black mt-1 ${met.color}`}>
                                    {met.noCurrency ? met.value || 0 : `KSh ${(met.value || 0).toLocaleString()}`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Recent Orders Section */}
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
                                  {selectedSeller.recentOrders?.map((order: Record<string, unknown>) => (
                                    <tr key={order.id} className="text-sm hover:bg-white/[0.02] transition-colors group/row">
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
                                  {(!selectedSeller.recentOrders || selectedSeller.recentOrders.length === 0) && (
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
                        </>
                      )}
                    </div>
                    <div className="p-8 border-t border-white/10 bg-white/[0.02] flex justify-between items-center">
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Session ID: {inspectionSessionId}</p>
                      <Button onClick={closeSellerModal} className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-[1.5rem] hover:bg-gray-200 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 group">
                        Close Inspection
                        <X className="ml-3 h-5 w-5 group-hover:rotate-90 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Buyer Details Modal */}
              {selectedBuyer && (
                <div
                  className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300 overflow-hidden z-[100]"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="buyer-modal-title"
                >
                  <div className="bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[2.5rem] w-full max-w-4xl max-h-[95vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.1)] scale-in-95 duration-300">
                    <div className="flex items-center justify-between p-5 md:p-8 border-b border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-inner">
                          <UserCircle className="h-5 w-5 md:h-7 md:w-7 text-cyan-500" />
                        </div>
                        <div>
                          <h3 id="buyer-modal-title" className="text-xl md:text-2xl font-black text-white tracking-tight">{selectedBuyer.name}</h3>
                          <p className="text-xs md:text-sm text-gray-400 font-medium">Customer Intelligence Report</p>
                        </div>
                      </div>
                      <button onClick={closeBuyerModal} className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group">
                        <X className="h-5 w-5 md:h-6 md:w-6 text-gray-400 group-hover:text-white group-hover:rotate-90 transition-all" />
                      </button>
                    </div>
                    <div className="overflow-auto flex-1 p-5 md:p-8 custom-scrollbar space-y-6 md:space-y-8">
                      {isLoadingBuyer ? (
                        <div className="flex flex-col items-center justify-center h-60 space-y-4">
                          <Loader2 className="h-12 w-12 text-cyan-500 animate-spin" />
                          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Analyzing User Patterns...</p>
                        </div>
                      ) : (
                        <>
                          <Card className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8">
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8">Identity Protocol</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                              {[
                                { label: 'Full Legal Name', value: selectedBuyer.name },
                                { label: 'Primary Communications', value: selectedBuyer.email },
                                { label: 'Mobile Link', value: selectedBuyer.phone },
                                { label: 'Primary City', value: selectedBuyer.city },
                                { label: 'Last Known Location', value: selectedBuyer.location },
                                { label: 'Account Status', value: selectedBuyer.status, isBadge: true },
                                { label: 'Joined Network', value: safeFormatDate(selectedBuyer.createdAt) }
                              ].map((info, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-white/5">
                                  <span className="text-gray-500 text-sm font-medium">{info.label}</span>
                                  {info.isBadge ? (
                                    <Badge className="bg-green-500/10 text-green-400 border-none">{info.value}</Badge>
                                  ) : (
                                    <span className="text-sm font-bold text-gray-200">{info.value || 'N/A'}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </Card>
                        </>
                      )}
                    </div>
                    <div className="p-8 border-t border-white/10 bg-white/[0.02] flex justify-end">
                      <Button onClick={closeBuyerModal} className="bg-white text-black font-black uppercase tracking-widest px-10 py-4 rounded-2xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        Close Report
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
    </>
  );
}


