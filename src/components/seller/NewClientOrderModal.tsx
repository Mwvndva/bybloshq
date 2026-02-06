import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShoppingCart, Clock, Smartphone, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Product {
    id: number;
    name: string;
    price: number;
    status: string;
}

interface NewClientOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onSubmit: (data: {
        clientName: string;
        clientPhone: string;
        paymentType: 'stk' | 'debt';
        items: Array<{
            productId: string;
            name: string;
            quantity: number;
            price: number;
        }>;
    }) => Promise<void>;
}

export default function NewClientOrderModal({
    isOpen,
    onClose,
    products,
    onSubmit
}: NewClientOrderModalProps) {
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'stk' | 'debt'>('stk');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter for available products only
    const availableProducts = products.filter(p => p.status === 'available');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!clientName.trim()) {
            toast.error('Please enter client name');
            return;
        }

        if (!clientPhone.trim()) {
            toast.error('Please enter phone number');
            return;
        }

        const phoneRegex = /^(?:254|0)[17]\d{8}$/;
        if (!phoneRegex.test(clientPhone.replace(/\s+/g, ''))) {
            toast.error('Invalid phone number. Use format: 0712345678 or 254712345678');
            return;
        }

        if (!selectedProductId) {
            toast.error('Please select a product');
            return;
        }

        // Find selected product
        const selectedProduct = availableProducts.find(p => p.id.toString() === selectedProductId);
        if (!selectedProduct) {
            toast.error('Product not found');
            return;
        }

        // Submit
        setIsSubmitting(true);
        try {
            await onSubmit({
                clientName: clientName.trim(),
                clientPhone: clientPhone.replace(/\s+/g, ''),
                paymentType: paymentMethod,
                items: [
                    {
                        productId: selectedProductId,
                        name: selectedProduct.name,
                        quantity: 1,
                        price: selectedProduct.price
                    }
                ]
            });

            // Reset form on success
            setClientName('');
            setClientPhone('');
            setSelectedProductId('');
            setPaymentMethod('stk');
        } catch (error) {
            console.error('Submission error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setClientName('');
            setClientPhone('');
            setSelectedProductId('');
            setPaymentMethod('stk');
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-[#09090b] border border-white/10 max-w-md shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                            <ShoppingCart className="h-5 w-5 text-yellow-400" />
                        </div>
                        New Client Order
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-2">
                    {/* Payment Method Selector */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-400 uppercase tracking-wider text-[10px]">
                            Payment Method
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('stk')}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200",
                                    paymentMethod === 'stk'
                                        ? "bg-yellow-400/10 border-yellow-400/50 text-yellow-400"
                                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                )}
                            >
                                <Smartphone className="h-5 w-5" />
                                <span className="text-xs font-semibold">M-Pesa Prompt</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('debt')}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200",
                                    paymentMethod === 'debt'
                                        ? "bg-blue-500/10 border-blue-400/50 text-blue-400"
                                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                )}
                            >
                                <Clock className="h-5 w-5" />
                                <span className="text-xs font-semibold">Record as Debt</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Client Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="clientName" className="text-sm font-medium text-gray-200">
                                Client Name
                            </Label>
                            <Input
                                id="clientName"
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Enter client name"
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-white/20 focus:ring-1 focus:ring-white/20 h-11"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Phone Number */}
                        <div className="space-y-1.5">
                            <Label htmlFor="clientPhone" className="text-sm font-medium text-gray-200">
                                Phone Number
                            </Label>
                            <Input
                                id="clientPhone"
                                type="tel"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                placeholder="0712345678"
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-white/20 focus:ring-1 focus:ring-white/20 h-11"
                                disabled={isSubmitting}
                            />
                            <p className="text-[11px] text-gray-500">
                                {paymentMethod === 'stk'
                                    ? "Payment prompt will be sent to this number"
                                    : "Used for order notifications and records"}
                            </p>
                        </div>

                        {/* Product Select */}
                        <div className="space-y-1.5">
                            <Label htmlFor="product" className="text-sm font-medium text-gray-200">
                                Select Product
                            </Label>
                            <Select
                                value={selectedProductId}
                                onValueChange={setSelectedProductId}
                                disabled={isSubmitting || availableProducts.length === 0}
                            >
                                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-white/20 focus:ring-1 focus:ring-white/20 h-11">
                                    <SelectValue placeholder="Choose a product" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#18181b] border-white/10">
                                    {availableProducts.length === 0 ? (
                                        <SelectItem value="none" disabled>
                                            No available products
                                        </SelectItem>
                                    ) : (
                                        availableProducts.map((product) => (
                                            <SelectItem
                                                key={product.id}
                                                value={product.id.toString()}
                                                className="text-white hover:bg-white/10"
                                            >
                                                {product.name} - KSh {product.price.toLocaleString()}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="text-gray-400 hover:text-white hover:bg-white/5"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || availableProducts.length === 0}
                            className={cn(
                                "min-w-[160px] font-bold shadow-lg transition-all duration-300",
                                paymentMethod === 'stk'
                                    ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-yellow-500/20"
                                    : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20"
                            )}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    {paymentMethod === 'stk' ? (
                                        <Smartphone className="mr-2 h-4 w-4" />
                                    ) : (
                                        <Clock className="mr-2 h-4 w-4" />
                                    )}
                                    {paymentMethod === 'stk' ? 'Send Prompt' : 'Record Debt'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
