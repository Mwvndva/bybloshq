import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Product } from '@/api/sellerApi';
import { toast } from 'sonner';

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

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setClientName('');
            setClientPhone('');
            setSelectedProduct('');
            setQuantity(1);
            setCart([]);
        }
    }, [isOpen]);

    const handleAddToCart = () => {
        if (!selectedProduct) {
            toast.error('Please select a product');
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
            toast.success('Quantity updated');
        } else {
            // Add new item
            setCart([...cart, {
                productId: product.id,
                name: product.name,
                quantity,
                price: product.price
            }]);
            toast.success('Product added to order');
        }

        // Reset selection
        setSelectedProduct('');
        setQuantity(1);
    };

    const handleRemoveFromCart = (productId: string) => {
        setCart(cart.filter(item => item.productId !== productId));
        toast.info('Product removed');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!clientName.trim()) {
            toast.error('Please enter client name');
            return;
        }

        if (!clientPhone.trim()) {
            toast.error('Please enter client phone number');
            return;
        }

        const phoneRegex = /^(?:254|0)[17]\d{8}$/;
        if (!phoneRegex.test(clientPhone.replace(/\s+/g, ''))) {
            toast.error('Invalid phone number. Use format: 0712345678 or 254712345678');
            return;
        }

        if (cart.length === 0) {
            toast.error('Please add at least one product');
            return;
        }

        // Submit
        onSubmit({
            clientName: clientName.trim(),
            clientPhone: clientPhone.replace(/\s+/g, ''),
            items: cart
        });
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justifycenter bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        New Client Order
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Client Information */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Client Information
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                placeholder="John Doe"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                M-Pesa Phone Number *
                            </label>
                            <input
                                type="tel"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                placeholder="0712345678 or 254712345678"
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Payment prompt will be sent to this number
                            </p>
                        </div>
                    </div>

                    {/* Product Selection */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Add Products
                        </h3>
                        <div className="flex gap-2">
                            <select
                                value={selectedProduct}
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                placeholder="Qty"
                            />
                            <button
                                type="button"
                                onClick={handleAddToCart}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Cart */}
                    {cart.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Order Summary
                            </h3>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700">
                                {cart.map((item) => (
                                    <div key={item.productId} className="p-3 flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {item.name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {item.quantity} x KES {item.price} = KES {item.quantity * item.price}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFromCart(item.productId)}
                                            className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Total Amount:
                                        </span>
                                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                                            KES {totalAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                        disabled={cart.length === 0}
                    >
                        Create Order & Send Payment
                    </button>
                </div>
            </div>
        </div>
    );
}
