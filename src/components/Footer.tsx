import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-stone-200 bg-white py-8">
      <div className="w-full px-6 sm:px-10 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm font-semibold tracking-tight text-stone-700">
          <a href="mailto:bybloshqke@zohomail.com" className="hover:text-black transition-colors">
            bybloshqke@zohomail.com
          </a>

          <a href="tel:+254111548797" className="hover:text-black transition-colors">
            +254 111 548 797
          </a>

          <a
            href="https://www.instagram.com/bybloshq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-black transition-colors"
          >
            <Instagram className="h-4 w-4" />
            <span>Instagram</span>
          </a>

          <Link
            to="/seller"
            className="inline-flex rounded-full border border-stone-200 bg-[#f8f7f2] px-4 py-1.5 text-stone-950 transition-colors hover:border-yellow-300 hover:bg-yellow-100"
          >
            Sell on Byblos
          </Link>

          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-widest">
            <span className="text-stone-500">Partners:</span>
            <span className="text-stone-800 italic font-serif">Mzigoego</span>
            <span className="text-stone-800 italic">Payment Provider</span>
            <span className="text-stone-800">EVOLVE</span>
          </div>

          <p className="text-[10px] text-stone-500 tracking-widest font-semibold uppercase">
            &copy; 2025 BYBLOS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
