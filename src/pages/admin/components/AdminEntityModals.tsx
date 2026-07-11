import { AdminSellerDetailModal, type SellerDetail } from './AdminSellerDetailModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { Loader2, UserCircle, X } from 'lucide-react';


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

// Display-only views over the dynamic admin entity payloads.

interface BuyerDetail {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  location?: string;
  status?: string;
  createdAt?: string;
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
  const seller = selectedSeller as SellerDetail | null;
  const buyer = selectedBuyer as BuyerDetail | null;
  return (
    <>
            {/* Modals Layer */}
            <div className="z-[100]">
              {/* Seller Details Modal */}
              <AdminSellerDetailModal seller={seller} isLoading={isLoadingSeller} onClose={closeSellerModal} safeFormatDate={safeFormatDate} inspectionSessionId={inspectionSessionId} />

              {/* Buyer Details Modal */}
              {buyer && (
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
                          <h3 id="buyer-modal-title" className="text-xl md:text-2xl font-black text-white tracking-tight">{buyer.name}</h3>
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
                                { label: 'Full Legal Name', value: buyer.name },
                                { label: 'Primary Communications', value: buyer.email },
                                { label: 'Mobile Link', value: buyer.phone },
                                { label: 'Primary City', value: buyer.city },
                                { label: 'Last Known Location', value: buyer.location },
                                { label: 'Account Status', value: buyer.status, isBadge: true },
                                { label: 'Joined Network', value: safeFormatDate(buyer.createdAt) }
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


