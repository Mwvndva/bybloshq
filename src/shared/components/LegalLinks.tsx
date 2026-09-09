import { useState } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import TermsModal from './TermsModal';

/**
 * Two buttons — "Terms & Conditions" and "Privacy Policy" — that open the same
 * combined legal document (TermsContent) already used at registration and at
 * the public /terms and /privacy routes, each jumping straight to its own
 * section. Shared across the buyer, seller, and creator account settings so
 * an already-registered user can always re-read what they agreed to.
 */
export function LegalLinks({ className = '' }: { className?: string }) {
  const [openSection, setOpenSection] = useState<'agreement' | 'privacy' | null>(null);

  return (
    <>
      <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
        <button
          type="button"
          onClick={() => setOpenSection('agreement')}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-xs font-bold text-slate-700 dark:text-white/80 transition hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <FileText className="h-3.5 w-3.5" />
          Terms &amp; Conditions
        </button>
        <button
          type="button"
          onClick={() => setOpenSection('privacy')}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-xs font-bold text-slate-700 dark:text-white/80 transition hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Privacy Policy
        </button>
      </div>

      <TermsModal
        isOpen={openSection !== null}
        onClose={() => setOpenSection(null)}
        initialSection={openSection ?? 'privacy'}
      />
    </>
  );
}

export default LegalLinks;
