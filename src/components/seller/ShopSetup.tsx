import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Store, ArrowRight, MapPin, Loader2 } from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';
import { toast } from '@/components/ui/use-toast';
import ShopLocationPicker from './ShopLocationPicker';

export default function ShopSetup() {
    const navigate = useNavigate();
    const [hasShop, setHasShop] = useState<boolean | null>(null);
    const [address, setAddress] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSkip = () => {
        navigate('/seller/dashboard');
    };

    const handleLocationChange = (newAddress: string, newCoordinates: { lat: number; lng: number } | null) => {
        setAddress(newAddress);
        setCoordinates(newCoordinates);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address.trim() && !coordinates) {
            toast({
                title: 'Error',
                description: 'Please select a location for your shop.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: any = { physicalAddress: address };

            if (coordinates) {
                payload.latitude = coordinates.lat;
                payload.longitude = coordinates.lng;
            }

            await sellerApi.updateProfile(payload);
            toast({
                title: 'Success',
                description: 'Shop address saved successfully!',
                className: 'bg-green-50 border-green-200 text-green-900',
            });
            navigate('/seller/dashboard');
        } catch (error) {
            console.error('Error saving address:', error);
            toast({
                title: 'Error',
                description: 'Failed to save address. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="dark min-h-screen bg-[#070707] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-2xl mx-auto">
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex h-16 w-16 bg-white/5 border border-white/10 rounded-3xl items-center justify-center shadow-2xl backdrop-blur-xl animate-in zoom-in duration-700">
                        <Store className="h-8 w-8 text-yellow-400" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black text-white tracking-tight sm:text-5xl">
                            Complete your <span className="text-yellow-400">shop setup</span>
                        </h2>
                        <p className="text-gray-400 text-lg font-medium">
                            Tell us about your physical presence
                        </p>
                    </div>
                </div>

                <Card className="bg-white/[0.03] border-white/10 shadow-2xl backdrop-blur-3xl rounded-[40px] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <CardContent className="p-8 sm:p-12">
                        {hasShop === null ? (
                            <div className="space-y-10">
                                <div className="text-center space-y-2">
                                    <h3 className="text-2xl font-bold text-white">Do you have a physical shop?</h3>
                                    <p className="text-gray-400 font-medium">
                                        Adding your shop location helps local customers find you easily.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <Button
                                        onClick={() => handleSkip()}
                                        variant="outline"
                                        className="h-32 flex flex-col items-center justify-center gap-3 border-2 border-white/5 bg-white/[0.02] text-white hover:bg-white/[0.05] hover:border-white/20 rounded-[32px] transition-all group active:scale-95"
                                    >
                                        <div className="text-4xl group-hover:scale-110 transition-transform">🏠</div>
                                        <span className="font-bold text-base">No, online only</span>
                                    </Button>
                                    <Button
                                        onClick={() => setHasShop(true)}
                                        className="h-32 flex flex-col items-center justify-center gap-3 bg-yellow-400/10 border-2 border-yellow-400/20 hover:bg-yellow-400/20 hover:border-yellow-400/40 text-yellow-400 rounded-[32px] transition-all group active:scale-95 shadow-[0_0_30px_rgba(250,204,21,0.05)]"
                                    >
                                        <div className="text-4xl group-hover:scale-110 transition-transform">🏪</div>
                                        <span className="font-bold text-base">Yes, I have a shop</span>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                                <div className="flex items-center gap-4 py-4 px-6 bg-white/5 rounded-3xl border border-white/10 mb-2">
                                    <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center shrink-0">
                                        <MapPin className="w-6 h-6 text-black" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Store Location</h4>
                                        <p className="text-xs text-gray-500 font-medium leading-relaxed">Where can customers visit you?</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <ShopLocationPicker
                                        onLocationChange={handleLocationChange}
                                    />

                                    <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setHasShop(null)}
                                            className="flex-1 text-gray-400 hover:text-white hover:bg-white/5 h-14 rounded-2xl font-bold text-base"
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={isSubmitting || (!address.trim() && !coordinates)}
                                            className="flex-[2] bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-14 rounded-2xl text-base shadow-[0_10px_30px_-10px_rgba(250,204,21,0.4)] active:scale-95 transition-all group"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    Save & Continue
                                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
