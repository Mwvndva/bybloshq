import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

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
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-[rgba(17,17,17,0.75)] backdrop-blur-[12px] border border-white/10 max-w-md shadow-[0_0_24px_rgba(250,204,21,0.12)]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400/10 border border-yellow-400/20 shadow-[0_0_18px_rgba(250,204,21,0.18)] rounded-xl flex items-center justify-center">
                            <ShoppingCart className="h-5 w-5 text-yellow-300" />
                        </div>
                        New Client Order
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {/* Client Name */}
                    <div className="space-y-2">
                        <Label htmlFor="clientName" className="text-sm font-semibold text-gray-200">
                            Client Name
                        </Label>
                        <Input
                            id="clientName"
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="Enter client name"
                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus:border-yellow-400/50 focus:ring-yellow-400/20"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-2">
                        <Label htmlFor="clientPhone" className="text-sm font-semibold text-gray-200">
                            M-Pesa Phone Number
                        </Label>
                        <Input
                            id="clientPhone"
                            type="tel"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            placeholder="0712345678"
                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus:border-yellow-400/50 focus:ring-yellow-400/20"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-gray-400">Payment prompt will be sent to this number</p>
                    </div>

                    {/* Product Select */}
                    <div className="space-y-2">
                        <Label htmlFor="product" className="text-sm font-semibold text-gray-200">
                            Select Product
                        </Label>
                        <Select
                            value={selectedProductId}
                            onValueChange={setSelectedProductId}
                            disabled={isSubmitting || availableProducts.length === 0}
                        >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-yellow-400/50 focus:ring-yellow-400/20">
                                <SelectValue placeholder="Choose a product" />
                            </SelectTrigger>
                            <SelectContent className="bg-[rgba(17,17,17,0.95)] backdrop-blur-xl border-white/10">
                                {availableProducts.length === 0 ? (
                                    <SelectItem value="none" disabled>
                                        No available products
                                    </SelectItem>
                                ) : (
                                    availableProducts.map((product) => (
                                        <SelectItem
                                            key={product.id}
                                            value={product.id.toString()}
                                            className="text-white hover:bg-white/10 focus:bg-white/10"
                                        >
                                            {product.name} - KSh {product.price.toLocaleString()}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="text-gray-300 hover:text-white hover:bg-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || availableProducts.length === 0}
                            className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg font-bold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Send Payment Prompt
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
