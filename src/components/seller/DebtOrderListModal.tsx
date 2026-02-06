import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils'; // Assuming this utility exists or I'll reimplement
import { Loader2, AlertCircle, Phone, Calendar, ArrowRight } from 'lucide-react';

interface PendingDebtOrder {
    id: number;
    orderNumber: string;
    totalAmount: number;
    createdAt: string;
    clientName: string;
    clientPhone: string;
}

interface DebtOrderListModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: PendingDebtOrder[];
    onInitiatePayment?: (order: PendingDebtOrder) => void;
}

export function DebtOrderListModal({ isOpen, onClose, orders, onInitiatePayment }: DebtOrderListModalProps) {
    const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

    const handlePay = async (order: PendingDebtOrder) => {
        if (!onInitiatePayment) return;
        setProcessingOrderId(order.id);
        await onInitiatePayment(order);
        setProcessingOrderId(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Pending Debt Orders</DialogTitle>
                    <p className="text-gray-400 text-sm">
                        Review and initiate payments for pending debt orders.
                    </p>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {orders.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-white/20 rounded-xl">
                            <p className="text-gray-400">No pending debt orders found.</p>
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div
                                key={order.id}
                                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/10 transition-colors"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-lg">{order.orderNumber}</span>
                                        <span className="text-xs bg-orange-500/20 text-orange-200 px-2 py-0.5 rounded-full border border-orange-500/30">
                                            Pending Payment
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            {order.clientPhone} ({order.clientName})
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                                    <span className="text-xl font-black text-white">
                                        {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(order.totalAmount)}
                                    </span>

                                    {onInitiatePayment && (
                                        <Button
                                            size="sm"
                                            onClick={() => handlePay(order)}
                                            disabled={processingOrderId === order.id}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                                        >
                                            {processingOrderId === order.id ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                                    Processing
                                                </>
                                            ) : (
                                                <>
                                                    Initiate Payment
                                                    <ArrowRight className="w-3 h-3 ml-1" />
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} className="border-white/10 hover:bg-white/5 text-white">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
