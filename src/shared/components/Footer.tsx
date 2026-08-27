import { Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-black/[0.08] dark:border-white/10 bg-[var(--byblos-bg,#000000)] py-8 transition-colors duration-200">
      <div className="w-full px-6 sm:px-10 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm font-semibold tracking-tight text-slate-600 dark:text-white/70">
          <a href="mailto:bybloshqke@zohomail.com" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            bybloshqke@zohomail.com
          </a>

          <a href="tel:+254111548797" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            +254 111 548 797
          </a>

          <a
            href="https://www.instagram.com/bybloshq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Instagram className="h-4 w-4" />
            <span>Instagram</span>
          </a>

          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-widest">
            <span className="text-slate-400 dark:text-white/50">Partners:</span>
            <span className="text-slate-800 dark:text-white/80 italic font-serif">Mzigoego</span>
            <span className="text-slate-800 dark:text-white/80 italic">Paystack</span>
            <span className="text-slate-800 dark:text-white/80">EVOLVE</span>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-white/50 tracking-widest font-semibold uppercase">
            &copy; 2026 BYBLOS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
