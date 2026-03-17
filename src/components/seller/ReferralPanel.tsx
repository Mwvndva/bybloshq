import React, { useState, useEffect } from 'react';
import {
    Users,
    Gift,
    Lock,
    Copy,
    ExternalLink,
    CheckCircle2,
    Clock,
    TrendingUp,
    Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sellerApi, ReferralDashboard } from '@/api/sellerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface ReferralPanelProps {
    totalSales: number;
}

const ReferralPanel: React.FC<ReferralPanelProps> = ({ totalSales }) => {
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [data, setData] = useState<ReferralDashboard | null>(null);
    const { toast } = useToast();

    const isLocked = totalSales === 0;

    useEffect(() => {
        if (!isLocked) {
            fetchDashboard();
        } else {
            setLoading(false);
        }
    }, [isLocked]);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const dashboard = await sellerApi.getReferralDashboard();
            setData(dashboard);
        } catch (err: any) {
            console.error('[REFERRAL] Failed to fetch dashboard:', err);
            // Silence common 404/403 errors if first time
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateCode = async () => {
        try {
            setGenerating(true);
            const result = await sellerApi.generateReferralCode();
            setData(prev => prev ? { ...prev, ...result } : {
                referralCode: result.referralCode,
                referralLink: result.referralLink,
                totalReferralEarnings: 0,
                referred: []
            });
            toast({
                title: 'Referral program activated!',
                description: 'Your unique code and link are ready.',
            });
        } catch (err: any) {
            toast({
                title: 'Activation failed',
                description: err.message || 'Could not activate referral program.',
                variant: 'destructive',
            });
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copied!',
            description: `${label} copied to clipboard.`,
        });
    };

    const shareOnWhatsApp = () => {
        if (!data?.referralLink) return;
        const message = encodeURIComponent(`Join me on Byblos! Build your shop and start selling in Kenya. Sign up here: ${data.referralLink}`);
        window.open(`https://wa.me/?text=${message}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
            </div>
        );
    }

    // State 1: Locked (No sales yet)
    if (isLocked) {
        return (
            <Card className="bg-black/40 backdrop-blur-md border-white/5 overflow-hidden">
                <CardContent className="pt-10 pb-10 text-center relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent" />
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="h-8 w-8 text-gray-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Referrals Locked</h3>
                    <p className="text-gray-400 max-w-sm mx-auto mb-6">
                        Complete your first sale to unlock the referral program and start earning rewards.
                    </p>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 py-1 px-3">
                        Locked
                    </Badge>
                </CardContent>
            </Card>
        );
    }

    // State 2: Unlocked but no code generated yet
    if (!data?.referralCode) {
        return (
            <Card className="bg-black/40 backdrop-blur-md border-white/5">
                <CardContent className="pt-10 pb-10 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Gift className="h-8 w-8 text-yellow-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Unlock Rewards</h3>
                    <p className="text-gray-400 max-w-sm mx-auto mb-8">
                        Refer other sellers and earn 0.2% of their sales for 6 months!
                    </p>
                    <Button
                        onClick={handleGenerateCode}
                        disabled={generating}
                        className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-11 px-8 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                    >
                        {generating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <TrendingUp className="h-5 w-5 mr-2" />}
                        Activate Referrals
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // State 3: Active Referral Program
    return (
        <div className="space-y-6">
            {/* Link & Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-2 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border-white/5 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-medium text-gray-400">Share your link</h4>
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 uppercase text-[10px] tracking-wider">
                                Active
                            </Badge>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 flex items-center justify-between overflow-hidden">
                                <span className="text-sm font-mono text-gray-300 truncate mr-2">
                                    {data.referralLink}
                                </span>
                                <button
                                    onClick={() => copyToClipboard(data.referralLink || '', 'Referral link')}
                                    className="p-1.5 hover:bg-white/5 rounded-md transition-colors text-yellow-400"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                            <Button
                                onClick={shareOnWhatsApp}
                                className="bg-green-600/20 border border-green-500/20 hover:bg-green-600/30 text-green-400 rounded-xl"
                            >
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>

                        <p className="mt-4 text-xs text-gray-500 italic">
                            * Earnings are credited on the 1st of every month.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-yellow-400/5 border-yellow-400/10 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-5">
                        <Gift className="h-32 w-32 rotate-12" />
                    </div>
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Total Earned</h4>
                        <div className="text-3xl font-black text-yellow-400">
                            KES {data.totalReferralEarnings.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-yellow-400/50 mt-1 uppercase tracking-widest font-bold">
                            Squad Bonus
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Squad List */}
            <Card className="bg-black/40 border-white/5 backdrop-blur-md">
                <CardHeader className="p-5 border-b border-white/5 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5 text-gray-400" />
                            Your Squad
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Sellers you referred to Byblos
                        </CardDescription>
                    </div>
                    <Badge className="bg-white/5 text-gray-300 font-bold border-none">
                        {data.referred.length} Sellers
                    </Badge>
                </CardHeader>
                <CardContent className="p-0">
                    {data.referred.length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {data.referred.map((seller) => (
                                <div key={seller.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center font-bold text-gray-400">
                                            {seller.shopName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-white text-sm">{seller.shopName}</h5>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {seller.isActive ? (
                                                    <span className="flex items-center text-[10px] text-green-400 font-medium bg-green-400/10 px-1.5 py-0.5 rounded">
                                                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                                        Paying
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-[10px] text-gray-500 font-medium bg-white/5 px-1.5 py-0.5 rounded">
                                                        <Clock className="h-2.5 w-2.5 mr-1" />
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-white">
                                            KES {seller.totalEarned.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                            Earned so far
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Users className="h-6 w-6 text-gray-600" />
                            </div>
                            <p className="text-gray-500 text-sm">Your squad is empty. Start sharing!</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ReferralPanel;
