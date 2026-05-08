import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-200 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent" />

      <div className="w-full px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10 items-center">
          <div>
            <a
              href="mailto:bybloshqke@zohomail.com"
              className="text-slate-950 hover:text-yellow-700 transition-all text-sm font-semibold tracking-tight"
            >
              bybloshqke@zohomail.com
            </a>
          </div>

          <div className="lg:text-center">
            <a
              href="tel:+254111548797"
              className="text-slate-950 hover:text-yellow-700 transition-all text-sm font-semibold tracking-tight"
            >
              +254 111 548 797
            </a>
          </div>

          <div className="lg:text-center">
            <a
              href="https://www.instagram.com/bybloshq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-slate-950 hover:text-pink-500 transition-all text-sm font-semibold"
            >
              <Instagram className="h-4 w-4" />
              <span>Instagram</span>
            </a>
          </div>

          <div className="lg:text-right">
            <Link
              to="/seller"
              className="inline-flex text-slate-950 hover:text-yellow-700 transition-all text-sm font-semibold border border-slate-300 px-4 py-1.5 rounded-full hover:border-yellow-400/70"
            >
              Sell on Byblos
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="flex flex-wrap items-center justify-start gap-4 text-[10px] uppercase tracking-widest font-bold">
            <span className="text-slate-950">Partners:</span>
            <span className="text-slate-950 italic font-serif">Mzigoego</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-slate-950 italic">Payd</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-slate-950">EVOLVE</span>
          </div>

          <p className="text-[10px] text-slate-950 tracking-widest font-semibold uppercase lg:text-right">
            &copy; 2025 BYBLOS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
