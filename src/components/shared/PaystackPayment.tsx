import React from 'react';

export interface PaystackPaymentProps {
    email: string;
    amount: number;
    reference?: string;
    onSuccess?: (reference: any) => void;
    onClose?: () => void;
    onOpen?: () => void;
    metadata?: any;
}

const PaystackPayment: React.FC<PaystackPaymentProps> = ({
    email,
    amount,
    reference,
    onSuccess,
    onClose,
    onOpen,
}) => {
    React.useEffect(() => {
        if (onOpen) onOpen();
    }, [onOpen]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <h3 className="text-lg font-bold mb-4">Paystack Payment (Mock)</h3>
                <p className="mb-4 text-gray-600">
                    Payment provider 'react-paystack' is missing. This is a placeholder.
                </p>
                <div className="space-y-2">
                    <p><strong>Email:</strong> {email}</p>
                    <p><strong>Amount:</strong> {amount}</p>
                    <p><strong>Ref:</strong> {reference}</p>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={() => onClose?.()}
                        className="px-4 py-2 border rounded hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSuccess?.({ status: 'success', reference: reference || 'mock_ref_' + Date.now() })}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                        Simulate Success
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaystackPayment;
