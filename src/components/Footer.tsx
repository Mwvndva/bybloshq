import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';
import { useState } from 'react';
import TermsModal from './TermsModal';

const Footer = () => {
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  return (
    <footer className="bg-zinc-950 border-t border-white/5 pt-16 pb-8 overflow-hidden relative">
      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent shadow-[0_0_50px_rgba(250,204,21,0.1)]" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand & Location */}
          <div className="space-y-6">
            <h2 className="font-serif text-2xl font-bold text-white tracking-tight">Byblos</h2>
            <div className="space-y-2">
              <p className="text-white/40 text-sm font-light flex items-center gap-2">
                <MapPin className="h-4 w-4 opacity-50" />
                Nairobi, Kenya
              </p>
              <p className="text-white/30 text-xs font-light tracking-wide">© 2025 BYBLOS EXPERIENCE. ALL RIGHTS RESERVED.</p>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-6">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-white/50">Contact</h3>
            <div className="space-y-3">
              <a href="mailto:official@bybloshq.com" className="block text-white/60 hover:text-white transition-colors text-sm font-light underline-offset-4 hover:underline">official@bybloshq.com</a>
              <a href="tel:+254111548797" className="block text-white/60 hover:text-white transition-colors text-sm font-light">+254 111 548 797</a>
              <a href="https://www.instagram.com/bybloshq" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white/60 hover:text-pink-400 transition-all">
                <Instagram className="h-4 w-4" />
                <span className="text-sm">@bybloshq</span>
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-6">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-white/50">Explore</h3>
            <div className="space-y-3">
              <button
                onClick={() => setIsTermsModalOpen(true)}
                className="block text-white/60 hover:text-white transition-colors text-sm font-light"
              >
                Terms & Conditions
              </button>
              <Link to="/seller" className="block text-white/60 hover:text-white transition-colors text-sm font-light">Sell on Byblos</Link>
              <Link to="/organizer/events/new" className="block text-white/60 hover:text-white transition-colors text-sm font-light">Create an Event</Link>
            </div>
          </div>

          {/* Powered & Partners */}
          <div className="space-y-6">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-white/50">Partners</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <span className="text-white/40 text-sm font-serif italic">Mzigoego</span>
              <div className="w-1 h-1 bg-white/10 rounded-full" />
              <span className="text-white/40 text-sm font-serif italic tracking-widest uppercase">Payd</span>
            </div>
            <div className="pt-4 border-t border-white/5">
              <p className="text-[10px] text-white/20 tracking-tighter uppercase font-bold">Powered by EVOLVE System</p>
            </div>
          </div>
        </div>
      </div>

      <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
    </footer>
  );
};

export default Footer;
