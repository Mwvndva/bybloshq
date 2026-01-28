import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
        <Dialog open={true} onOpenChange={() => onClose?.()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Paystack Payment (Mock)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Payment provider 'react-paystack' is missing. This is a placeholder.
                    </p>
                    <div className="space-y-2 rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Email:</span>
                            <span className="font-medium">{email}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                            <span className="font-medium">{amount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Ref:</span>
                            <span className="font-mono text-xs">{reference}</span>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
                        <Button
                            variant="outline"
                            onClick={() => onClose?.()}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onSuccess?.({ status: 'success', reference: reference || 'mock_ref_' + Date.now() })}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                        >
                            Simulate Success
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PaystackPayment;
