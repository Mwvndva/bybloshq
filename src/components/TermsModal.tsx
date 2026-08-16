import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { TermsContent } from './TermsContent';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

const sections = [
  { id: 'privacy', label: '1. Privacy Policy' },
  { id: 'agreement', label: '2. Client Agreement' },
  { id: 'refund', label: '3. Refund Policy' },
  { id: 'risk', label: '4. Risk Disclosure' },
  { id: 'ip', label: '5. Intellectual Property' },
  { id: 'prohibited', label: '6. Prohibited Conduct' },
  { id: 'liability', label: '7. Limitation of Liability' },
  { id: 'disputes', label: '8. Dispute Resolution' },
  { id: 'amendments', label: '9. Amendments' },
  { id: 'governing', label: '10. Governing Law' },
];

const TermsModal = ({ isOpen, onClose, onAccept }: TermsModalProps) => {
  const [activeSection, setActiveSection] = useState('privacy');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        className="max-w-5xl sm:h-[92dvh] h-[100dvh] w-full sm:w-[95vw] flex flex-col p-0 overflow-hidden rounded-none sm:rounded-3xl bg-[#141414] dark:bg-[#141414] text-white dark:text-white border border-white/10 dark:border-white/10 shadow-2xl [&>button]:text-white/80 [&>button]:hover:text-white [&>button]:hover:bg-white/10"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Byblos Terms &amp; Conditions</DialogTitle>
          <DialogDescription>
            Official Byblos terms, conditions, privacy policy, and user agreements.
          </DialogDescription>
        </DialogHeader>

        {/* Header */}
        <div className="flex-shrink-0 bg-[#1a1a1a] text-white px-5 sm:px-8 py-5 sm:py-6 pr-14 sm:pr-16 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] tracking-[0.3em] text-[#c9a84c] uppercase mb-1">Legal Documentation</p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight" style={{ fontFamily: "'Georgia', serif" }}>
                BYBLOS TERMS &amp; CONDITIONS
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2">
                Effective Date: Jan 2026 &nbsp;|&nbsp; Ver 2.0 &nbsp;|&nbsp; ByblosHQ
              </p>
            </div>
            <div className="hidden sm:block text-right mr-6 sm:mr-8">
              <div className="inline-block border border-[#c9a84c] px-3 py-1 text-[10px] tracking-widest text-[#c9a84c] uppercase rounded">
                Legally Binding
              </div>
            </div>
          </div>
          <div className="mt-3.5 p-2.5 bg-[#c9a84c]/10 border-l-2 border-[#c9a84c] text-[10px] sm:text-xs text-[#e8d9a0] leading-normal rounded-r">
            <strong>IMPORTANT:</strong> By using Byblos, you agree to be bound by these Terms. If you do not agree, cease all use immediately.
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Nav - Horizontal on mobile, Sidebar on desktop */}
          <nav className="flex-shrink-0 w-full sm:w-52 bg-[#181818] border-b sm:border-b-0 sm:border-r border-white/10 flex sm:flex-col overflow-x-auto sm:overflow-y-auto py-2 sm:py-6 px-4 no-scrollbar">
            <p className="hidden sm:block text-[10px] tracking-widest text-gray-400 uppercase mb-4 px-2">Sections</p>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`flex-shrink-0 sm:w-full text-left text-[11px] sm:text-xs px-3 py-1.5 sm:py-2.5 rounded-lg mr-2 sm:mr-0 sm:mb-1 transition-all duration-150 leading-tight whitespace-nowrap sm:whitespace-normal
                  ${activeSection === s.id
                    ? 'bg-[#c9a84c] text-[#1a1a1a] font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div
            className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 text-[13px] sm:text-[13.5px] text-slate-300 bg-[#0d0d0d] leading-relaxed"
            onScroll={(e) => {
              const container = e.currentTarget;
              for (const s of sections) {
                const el = document.getElementById(`section-${s.id}`);
                if (el && el.offsetTop - container.scrollTop < 200) setActiveSection(s.id);
              }
            }}
          >
            <TermsContent />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/10 bg-[#161616] px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 italic">
            By clicking &quot;I Agree&quot; or using Byblos, you confirm you have read and accepted all terms above.
          </p>
          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs border border-white/20 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
            >
              Decline
            </button>
            <button
              onClick={() => {
                if (onAccept) onAccept();
                onClose();
              }}
              className="px-6 py-2 text-xs bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl shadow-lg transition-colors tracking-wide"
            >
              I Agree
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsModal;
