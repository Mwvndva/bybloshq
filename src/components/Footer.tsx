import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-black py-8 relative overflow-hidden">
      <div className="w-full px-6 sm:px-10 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm font-semibold tracking-tight text-white">
          <a href="mailto:bybloshqke@zohomail.com" className="hover:text-yellow-300 transition-colors">
            bybloshqke@zohomail.com
          </a>

          <a href="tel:+254111548797" className="hover:text-yellow-300 transition-colors">
            +254 111 548 797
          </a>

          <a
            href="https://www.instagram.com/bybloshq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-pink-300 transition-colors"
          >
            <Instagram className="h-4 w-4" />
            <span>Instagram</span>
          </a>

          <Link
            to="/seller"
            className="inline-flex hover:text-yellow-300 transition-colors border border-white/20 px-4 py-1.5 rounded-full hover:border-yellow-300/70"
          >
            Sell on Byblos
          </Link>

          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-widest">
            <span className="text-white/75">Partners:</span>
            <span className="text-white italic font-serif">Mzigoego</span>
            <span className="text-white italic">Payment Provider</span>
            <span className="text-white">EVOLVE</span>
          </div>

          <p className="text-[10px] text-white/75 tracking-widest font-semibold uppercase">
            &copy; 2025 BYBLOS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
