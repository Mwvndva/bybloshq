import React, { useState } from 'react';
import { Loader2, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface WithdrawalModalProps {
    isOpen: boolean;
    onClose: () => void;
    balance: number;
    onWithdraw: (data: { amount: string; mpesaNumber: string; mpesaName: string }) => Promise<void>;
    isLoading: boolean;
    withdrawalRequests: any[]; // Pass history for reference
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
    isOpen,
    onClose,
    balance,
    onWithdraw,
    isLoading,
    withdrawalRequests
}) => {
    const [form, setForm] = useState({
        amount: '',
        mpesaNumber: '',
        mpesaName: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onWithdraw(form);
        setForm({ amount: '', mpesaNumber: '', mpesaName: '' });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black">Request Withdrawal</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Available Balance: <span className="text-emerald-400 font-bold">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(balance)}</span>.
                        Minimum withdrawal: KSh 50.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 md:grid-cols-2 mt-4">
                    {/* Withdrawal Form */}
                    <div className="space-y-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-gray-300">Amount (KSh)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                                    placeholder="Enter amount"
                                    min="50" // Enforce minimum 50
                                    max={balance}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-400"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="mpesaNumber" className="text-gray-300">M-Pesa Number</Label>
                                <Input
                                    id="mpesaNumber"
                                    type="tel"
                                    value={form.mpesaNumber}
                                    onChange={(e) => setForm(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                                    placeholder="07..."
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-400"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="mpesaName" className="text-gray-300">Name on M-Pesa</Label>
                                <Input
                                    id="mpesaName"
                                    value={form.mpesaName}
                                    onChange={(e) => setForm(prev => ({ ...prev, mpesaName: e.target.value }))}
                                    placeholder="Full Name"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-yellow-400"
                                    required
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <Button
                                    type="submit"
                                    disabled={isLoading || balance < 50}
                                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing
                                        </>
                                    ) : (
                                        'Submit Request'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* History Sidebar */}
                    <div className="border-l border-white/10 pl-6 hidden md:block">
                        <h4 className="font-bold text-gray-300 mb-3 text-sm uppercase tracking-wider">Recent Requests</h4>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {withdrawalRequests.length > 0 ? (
                                withdrawalRequests.slice(0, 5).map(req => (
                                    <div key={req.id} className="p-3 rounded-lg bg-white/5 border border-white/5 text-xs">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-white">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(req.amount)}</span>
                                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[10px] ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                                    req.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                                                        'bg-red-500/20 text-red-300'
                                                }`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <div className="text-gray-400">
                                            {new Date(req.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm">No recent requests.</p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
