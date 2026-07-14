import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface DeleteAccountButtonProps {
  /** Calls the account-deletion endpoint. Resolves on success. */
  deleteAccount: () => Promise<unknown>;
  /** Invoked after a successful deletion (typically the logout handler). */
  onDeleted: () => void;
}

/**
 * Two-step "Delete account" control (Google Play data-deletion requirement).
 * Dark-themed so it reads correctly on the black surfaces it lives on.
 */
export function DeleteAccountButton({ deleteAccount, onDeleted }: DeleteAccountButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      toast({ title: 'Account deleted', description: 'Your account and personal data have been removed.' });
      onDeleted();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: 'Could not delete account',
        description: err.response?.data?.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <Button
        variant="outline"
        onClick={() => setConfirming(true)}
        className="h-10 w-full justify-center gap-2 border-red-500/30 bg-transparent font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
        Delete account
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3">
      <p className="text-xs font-semibold text-white/80">
        Permanently delete your account and personal data? This can’t be undone.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={handleDelete}
          disabled={busy}
          className="h-9 flex-1 bg-red-600 font-bold text-white hover:bg-red-500"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, delete'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="h-9 flex-1 border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
