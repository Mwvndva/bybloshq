import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, User, Phone, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RefundRequest } from './refundRequestsTypes';

interface RefundRequestCardProps {
  request: RefundRequest;
  getStatusBadge: (status: string) => ReactNode;
  formatCurrency: (value: string) => string;
  onApprove: () => void;
  onReject: () => void;
}

export function RefundRequestCard({ request, getStatusBadge, formatCurrency, onApprove, onReject }: RefundRequestCardProps) {
  return (
    <Card key={request.id} className="bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group hover:border-white/20 transition-all duration-500">
              <CardHeader className="p-8 border-b border-white/5 bg-white/[0.01]">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-60">Sequence</p>
                      <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] font-black text-white">#{request.id}</div>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Captured: {format(new Date(request.requested_at), 'MMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40">Subject Identification</p>
                    <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-base font-black text-white tracking-tight">{request.buyer_name}</p>
                        <p className="text-[10px] font-bold text-gray-500 lowercase opacity-60">{request.buyer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                      <Phone className="h-3 w-3" />
                      {request.buyer_phone}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40">Capital Breakdown</p>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] text-green-400/60 font-black uppercase tracking-widest mb-1">Requested Reclamation</p>
                      <p className="text-3xl font-black text-green-400 tracking-tighter tabular-nums">
                        {formatCurrency(request.amount)}
                      </p>
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 opacity-60">
                      Total Allocation: <span className="text-white ml-2 tabular-nums">{formatCurrency(request.buyer_current_refunds)}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40 mb-3">Protocol</p>
                      <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 text-xs font-bold text-white tracking-tight">
                        {request.payment_method}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40 mb-3">Endpoint Meta</p>
                      <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2">
                        {(() => {
                          try {
                            const details = typeof request.payment_details === 'string'
                              ? JSON.parse(request.payment_details)
                              : request.payment_details;
                            return (
                              <>
                                {details.phone && <p className="text-xs font-bold text-gray-300">📱 {details.phone}</p>}
                                {details.name && <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{details.name}</p>}
                              </>
                            );
                          } catch (e) {
                            return <p className="text-xs font-bold text-gray-600">NULL</p>;
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  {request.notes && (
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-40 mb-3">Subject Manifest</p>
                      <p className="text-xs font-medium text-gray-400 bg-white/[0.02] p-5 rounded-2xl border border-white/5 leading-relaxed">{request.notes}</p>
                    </div>
                  )}

                  {request.admin_notes && (
                    <div>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">Operator Annotation</p>
                      <p className="text-xs font-bold text-blue-400 bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20">{request.admin_notes}</p>
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className="flex gap-4 pt-6">
                    <Button
                      onClick={onApprove}
                      className="flex-1 h-14 bg-green-500 hover:bg-green-400 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all duration-300 shadow-lg shadow-green-500/10"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Authorize Payout
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onReject}
                      className="flex-1 h-14 border-white/10 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl bg-transparent font-black text-[10px] uppercase tracking-widest transition-all duration-300"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Veto Request
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
  );
}
