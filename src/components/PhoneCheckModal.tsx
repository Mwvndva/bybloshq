import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Loader2 } from 'lucide-react';

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
      <DialogContent className="flex flex-col w-[95vw] max-w-[425px] max-h-[85dvh] p-0 gap-0 overflow-hidden rounded-3xl border border-white/10 shadow-2xl bg-[#0a0a0a] text-white">
        <DialogHeader className="p-6 sm:p-8 pb-2 shrink-0 space-y-4">
          <div className="mx-auto w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
            <Phone className="h-7 w-7 text-yellow-400" />
          </div>
          <DialogTitle className="text-2xl font-black text-center text-white">Verification</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-black uppercase tracking-wider text-[#a1a1a1] ml-1">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. 0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isLoading}
                className="rounded-xl border-white/10 focus-visible:ring-yellow-400 h-12 bg-white/5 text-base px-4 text-white placeholder:text-[#555555]"
              />
              {error && <p className="text-sm text-red-500 font-medium ml-1">{error}</p>}
            </div>
            <p className="text-sm text-[#a1a1a1] font-medium leading-relaxed px-1">
              Please enter your phone number to check if you have an existing account.
            </p>
          </div>
          <div className="flex flex-col gap-3 p-6 sm:p-8 pt-4 mt-auto border-t border-white/5 shrink-0 bg-white/2 backdrop-blur-sm">
            <Button
              type="submit"
              disabled={isLoading}
              variant="secondary-byblos"
              className="w-full h-12 rounded-xl font-black text-base shadow-lg transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Checking...</span>
                </div>
              ) : 'Continue'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-full rounded-xl text-[#a1a1a1] hover:text-white hover:bg-white/5 font-bold"
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

