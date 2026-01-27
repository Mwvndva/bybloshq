import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, DollarSign, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import api from '@/lib/api';

interface Withdrawal {
    id: number;
    amount: number | string;
    status: 'processing' | 'completed' | 'failed' | 'cancelled';
    mpesa_number: string;
    mpesa_name: string;
    provider_reference?: string;
    created_at: string;
}

interface WithdrawalHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: number;
    eventName: string;
}

export function WithdrawalHistoryModal({
    isOpen,
    onClose,
    eventId,
    eventName
}: WithdrawalHistoryModalProps) {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && eventId) {
            fetchHistory();
        }
    }, [isOpen, eventId]);

    interface WithdrawalHistoryResponse {
        status: string;
        data: {
            withdrawals: Withdrawal[];
        };
    }

    const fetchHistory = async () => {
        try {
            setIsLoading(true);
            const response = await api.get<WithdrawalHistoryResponse>(`/organizers/events/${eventId}/withdrawals`);
            if (response.data.status === 'success') {
                setWithdrawals(response.data.data.withdrawals);
            }
        } catch (error) {
            console.error('Failed to fetch withdrawal history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-900/30 text-green-400 border-green-500/20';
            case 'processing': return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/20';
            case 'failed': return 'bg-red-900/30 text-red-400 border-red-500/20';
            default: return 'bg-gray-800/60 text-gray-300 border-white/10';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-black/95 backdrop-blur-sm shadow-2xl rounded-3xl border border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-center flex items-center justify-center gap-2 text-white">
                        <DollarSign className="h-6 w-6 text-yellow-400" />
                        Payout History
                    </DialogTitle>
                    <p className="text-center text-gray-400 font-medium">{eventName}</p>
                </DialogHeader>

                <div className="mt-6">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
                        </div>
                    ) : withdrawals.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <p className="text-gray-400">No withdrawal history found for this event.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {withdrawals.map((withdrawal) => (
                                <div
                                    key={withdrawal.id}
                                    className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-lg text-white">
                                                KSh {Number(withdrawal.amount).toLocaleString('en-KE')}
                                            </h4>
                                            <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(withdrawal.created_at), "MMM d, yyyy 'at' h:mm a")}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className={`capitalize ${getStatusColor(withdrawal.status)}`}>
                                            {withdrawal.status}
                                        </Badge>
                                    </div>

                                    <div className="bg-white/5 rounded-xl p-3 text-sm space-y-2 border border-white/5">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Recipient</span>
                                            <span className="font-medium text-white">{withdrawal.mpesa_name} ({withdrawal.mpesa_number})</span>
                                        </div>
                                        {withdrawal.provider_reference && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Ref ID</span>
                                                <span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">
                                                    {withdrawal.provider_reference}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
