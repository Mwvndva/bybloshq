import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { Product } from '@/api/sellerApi';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
    }) => void;
}

interface SelectedProduct {
    productId: string;
    name: string;
    quantity: number;
    price: number;
}

export default function NewClientOrderModal({
    isOpen,
    onClose,
    products,
    onSubmit
}: NewClientOrderModalProps) {
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [cart, setCart] = useState<SelectedProduct[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setClientName('');
            setClientPhone('');
            setSelectedProduct('');
            setQuantity(1);
            setCart([]);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleAddToCart = () => {
        if (!selectedProduct) {
            toast.error('Please select a product', {
                className: 'bg-red-500/10 border-red-400/30 text-red-200'
            });
            return;
        }

        const product = products.find(p => p.id === selectedProduct);
        if (!product) return;

        // Check if product already in cart
        const existingIndex = cart.findIndex(item => item.productId === selectedProduct);
        if (existingIndex >= 0) {
            // Update quantity
            const newCart = [...cart];
            newCart[existingIndex].quantity += quantity;
            setCart(newCart);
            toast.success('Quantity updated', {
                className: 'bg-green-500/10 border-green-400/30 text-green-200'
            });
        } else {
            // Add new item
            setCart([...cart, {
                productId: product.id,
                name: product.name,
                quantity,
                price: product.price
            }]);
            toast.success('Product added to order', {
                className: 'bg-green-500/10 border-green-400/30 text-green-200'
            });
        }

        // Reset selection
        setSelectedProduct('');
        setQuantity(1);
    };

    const handleRemoveFromCart = (productId: string) => {
        setCart(cart.filter(item => item.productId !== productId));
        toast.info('Product removed', {
            className: 'bg-blue-500/10 border-blue-400/30 text-blue-200'
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!clientName.trim()) {
            toast.error('Please enter client name', {
                className: 'bg-red-500/10 border-red-400/30 text-red-200'
            });
            return;
        }

        if (!clientPhone.trim()) {
            toast.error('Please enter client phone number', {
                className: 'bg-red-500/10 border-red-400/30 text-red-200'
            });
            return;
        }

        const phoneRegex = /^(?:254|0)[17]\d{8}$/;
        if (!phoneRegex.test(clientPhone.replace(/\s+/g, ''))) {
            toast.error('Invalid phone number. Use format: 0712345678 or 254712345678', {
                className: 'bg-red-500/10 border-red-400/30 text-red-200'
            });
            return;
        }

        if (cart.length === 0) {
            toast.error('Please add at least one product', {
                className: 'bg-red-500/10 border-red-400/30 text-red-200'
            });
            return;
        }

        // Submit
        setIsSubmitting(true);
        try {
            await onSubmit({
                clientName: clientName.trim(),
                clientPhone: clientPhone.replace(/\s+/g, ''),
                items: cart
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[rgba(17,17,17,0.75)] backdrop-blur-[12px] border border-white/10 max-w-3xl p-0 overflow-hidden shadow-[0_0_24px_rgba(250,204,21,0.12)]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 bg-white/5">
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400/10 border border-yellow-400/20 shadow-[0_0_18px_rgba(250,204,21,0.18)] rounded-xl flex items-center justify-center">
                            <ShoppingCart className="h-5 w-5 text-yellow-300" />
                        </div>
                        New Client Order
                    </h2>
                    <p className="text-sm text-gray-300 font-medium mt-2">Create an order and send M-Pesa payment prompt</p>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-200px)]">
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                        {/* Client Information */}
                        <div className="space-y-4">
                            <h3 className="text-base font-black text-white tracking-tight">
                                Client Information
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-300 mb-2 tracking-tight">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-900 border border-white/10 rounded-xl text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-300 mb-2 tracking-tight">
                                        M-Pesa Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        value={clientPhone}
                                        onChange={(e) => setClientPhone(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-900 border border-white/10 rounded-xl text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium"
                                        placeholder="0712345678 or 254712345678"
                                        required
                                    />
                                    <p className="mt-1.5 text-xs text-gray-400">
                                        Payment prompt will be sent to this number
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Product Selection */}
                        <div className="space-y-4">
                            <h3 className="text-base font-black text-white tracking-tight">
                                Add Products
                            </h3>
                            <div className="flex gap-2 sm:gap-3">
                                <select
                                    value={selectedProduct}
                                    onChange={(e) => setSelectedProduct(e.target.value)}
                                    className="flex-1 px-4 py-2.5 bg-gray-900 border border-white/10 rounded-xl text-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium appearance-none"
                                >
                                    <option value="">Select a product...</option>
                                    {products.filter(p => p.status === 'available').map(product => (
                                        <option key={product.id} value={product.id}>
                                            {product.name} - KES {product.price}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 px-3 py-2.5 bg-gray-900 border border-white/10 rounded-xl text-white text-center focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all font-medium"
                                    placeholder="Qty"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddToCart}
                                    className="px-4 py-2.5 bg-white/5 border border-white/10 text-yellow-300 hover:bg-yellow-400/10 hover:border-yellow-400/30 rounded-xl transition-all font-semibold flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Add</span>
                                </button>
                            </div>
                        </div>

                        {/* Cart */}
                        {cart.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-base font-black text-white tracking-tight">
                                    Order Summary
                                </h3>
                                <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-[8px] overflow-hidden">
                                    <div className="divide-y divide-white/5">
                                        {cart.map((item) => (
                                            <div key={item.productId} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-white">
                                                        {item.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {item.quantity} × KES {item.price.toLocaleString()} = KES {(item.quantity * item.price).toLocaleString()}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFromCart(item.productId)}
                                                    className="ml-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-yellow-500/5 border-t border-yellow-400/20">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-semibold text-gray-300 tracking-tight">
                                                Total Amount:
                                            </span>
                                            <span className="text-xl font-black text-yellow-300">
                                                KES {totalAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-5 border-t border-white/10 bg-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 bg-transparent border border-white/10 text-gray-200 hover:bg-white/5 rounded-xl transition-all font-semibold"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg hover:shadow-[0_0_24px_rgba(250,204,21,0.25)] rounded-xl transition-all font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={cart.length === 0 || isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="h-4 w-4" />
                                    Send Payment Prompt
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
