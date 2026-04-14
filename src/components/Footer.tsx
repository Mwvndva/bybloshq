import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-black border-t border-white/5 py-12 relative overflow-hidden">
      {/* Sleek accent line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-4">

          {/* Contact & Socials - Minimal Stack */}
          <div className="flex flex-wrap items-center gap-6">
            <a
              href="mailto:official@bybloshq.com"
              className="text-zinc-400 hover:text-white transition-all text-sm font-medium tracking-tight"
            >
              official@bybloshq.com
            </a>

            <a
              href="tel:+254111548797"
              className="text-zinc-400 hover:text-white transition-all text-sm font-medium tracking-tight"
            >
              +254 111 548 797
            </a>

            <a
              href="https://www.instagram.com/bybloshq"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-zinc-400 hover:text-pink-500 transition-all text-sm font-medium"
            >
              <Instagram className="h-4 w-4" />
              <span>Instagram</span>
            </a>
          </div>

          {/* Action links */}
          <div className="flex items-center gap-6">
            <Link
              to="/seller"
              className="text-zinc-400 hover:text-yellow-400 transition-all text-sm font-medium border border-white/10 px-4 py-1.5 rounded-full hover:border-yellow-400/30"
            >
              Sell on Byblos
            </Link>
          </div>
        </div>

        {/* Bottom Bar: Partners & Copyright */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold">
            <span className="text-zinc-600">Partners:</span>
            <span className="text-zinc-400 italic font-serif">Mzigoego</span>
            <div className="w-1 h-1 bg-white/10 rounded-full" />
            <span className="text-zinc-400 italic">Payd</span>
            <div className="w-1 h-1 bg-white/10 rounded-full" />
            <span className="text-zinc-500">EVOLVE</span>
          </div>

          <p className="text-[10px] text-zinc-600 tracking-widest font-medium uppercase">
            © 2025 BYBLOS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
