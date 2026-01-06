import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PhoneCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhoneSubmit: (phone: string) => void;
  isLoading?: boolean;
}

const PhoneCheckModal: React.FC<PhoneCheckModalProps> = ({
  isOpen,
  onClose,
  onPhoneSubmit,
  isLoading = false
}) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    // Basic phone validation (adjust pattern as needed)
    const phonePattern = /^(\+?254|0)[17]\d{8}$/;
    if (!phonePattern.test(phone.trim())) {
      setError('Please enter a valid phone number (e.g., +254712345678 or 0712345678)');
      return;
    }

    onPhoneSubmit(phone.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[95vw] max-w-[425px] max-h-[85dvh] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-xl bg-white/95 backdrop-blur-md">
        <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl font-black text-center text-gray-900">Enter Your Phone Number</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 py-2 space-y-3">
            <Label htmlFor="phone" className="text-sm font-semibold text-gray-700 ml-1">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+254712345678 or 0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={isLoading}
              className="rounded-xl border-gray-200 focus-visible:ring-yellow-400 h-10 bg-gray-50/50 text-base px-3"
            />
            {error && <p className="text-sm text-red-500 font-medium ml-1">{error}</p>}
            <p className="text-sm text-gray-500 ml-1">
              We'll check if you have an account with us
            </p>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:p-6 pt-2 mt-auto border-t shrink-0 bg-white/50 backdrop-blur-sm">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold text-sm shadow-md shadow-yellow-200 transition-all"
            >
              {isLoading ? 'Checking...' : 'Continue'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-full rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneCheckModal;

