import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Store, ArrowRight } from 'lucide-react';
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
        <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
                <div className="flex justify-center">
                    <div className="h-12 w-12 bg-yellow-500/10 border border-yellow-400/20 rounded-xl flex items-center justify-center shadow-[0_0_18px_rgba(250,204,21,0.18)]">
                        <Store className="h-6 w-6 text-yellow-300" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
                    Complete your shop setup
                </h2>
                <p className="mt-2 text-center text-sm text-gray-400">
                    Tell us about your physical presence
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-3xl">
                <Card className="bg-[rgba(20,20,20,0.7)] backdrop-blur-[12px] border border-white/10 shadow-lg">
                    <CardContent className="p-8">
                        {hasShop === null ? (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h3 className="text-lg font-medium text-white mb-2">Do you have a physical shop?</h3>
                                    <p className="text-sm text-gray-400 mb-6">
                                        Adding your shop location helps local customers find you easily.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                                    <Button
                                        onClick={() => handleSkip()}
                                        variant="outline"
                                        className="h-24 flex flex-col gap-2 border-2 border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:border-white/20"
                                    >
                                        <span className="text-2xl">🏠</span>
                                        <span className="font-semibold text-gray-200">No, online only</span>
                                    </Button>
                                    <Button
                                        onClick={() => setHasShop(true)}
                                        className="h-24 flex flex-col gap-2 bg-yellow-500/10 border-2 border-yellow-400/20 hover:bg-yellow-500/15 hover:border-yellow-400/30 text-yellow-100 shadow-[0_0_18px_rgba(250,204,21,0.12)]"
                                    >
                                        <span className="text-2xl">🏪</span>
                                        <span className="font-semibold">Yes, I have a shop</span>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <ShopLocationPicker
                                    onLocationChange={handleLocationChange}
                                />

                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setHasShop(null)}
                                        className="flex-1 text-gray-200 hover:bg-white/5 hover:text-white"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || (!address.trim() && !coordinates)}
                                        className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-md font-semibold"
                                    >
                                        {isSubmitting ? 'Saving...' : 'Save & Continue'}
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
