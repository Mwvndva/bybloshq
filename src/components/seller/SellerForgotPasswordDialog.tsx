import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';

interface SellerForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSending: boolean;
}

export function SellerForgotPasswordDialog({ open, onOpenChange, email, onEmailChange, onSubmit, isSending }: SellerForgotPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[90vw] sm:max-w-[340px] rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0a0a0a] text-slate-950 dark:text-white shadow-2xl mx-4 sm:mx-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">Forgot Password</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-300 font-medium">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700 dark:text-slate-200">Email Address</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
                  <Mail className="h-4 w-4 text-slate-400 dark:text-white/40" />
                </div>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  className="!pl-12 h-10 rounded-xl bg-white dark:bg-[#141414] border-slate-300 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400 text-sm"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSending}
              className="w-full h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold tracking-tight transition-all duration-200 text-sm"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : 'Send Reset Link'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
  );
}
