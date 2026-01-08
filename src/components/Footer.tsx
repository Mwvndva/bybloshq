import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';
import { useState } from 'react';
import TermsModal from './TermsModal';

const Footer = () => {
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  return (
    <footer className="bg-yellow-300 border-t-4 border-yellow-400">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8 text-center md:text-left">
          {/* Location */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-bold text-black mb-3 text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </h3>
            <p className="text-gray-800 text-sm leading-relaxed">
              Nairobi, Kenya
              <br />
              East Africa
            </p>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-bold text-black mb-3 text-lg">Contact Us</h3>
            <div className="space-y-2 text-sm flex flex-col items-center md:items-start">
              <a
                href="mailto:official@bybloshq.com"
                className="flex items-center gap-2 text-gray-800 hover:text-black transition-colors"
              >
                <Mail className="h-4 w-4" />
                official@bybloshq.com
              </a>
              <a
                href="tel:+254111548797"
                className="flex items-center gap-2 text-gray-800 hover:text-black transition-colors"
              >
                <Phone className="h-4 w-4" />
                +254 111 548 797
              </a>
              <a
                href="https://www.instagram.com/bybloshq"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-800 hover:text-pink-600 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
                @bybloshq
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-bold text-black mb-3 text-lg">Quick Links</h3>
            <div className="space-y-2 text-sm flex flex-col items-center md:items-start">
              <button
                onClick={() => setIsTermsModalOpen(true)}
                className="text-gray-800 hover:text-black transition-colors cursor-pointer"
              >
                Terms & Conditions
              </button>
              <Link
                to="/seller"
                className="text-gray-800 hover:text-black transition-colors"
              >
                Sell on Byblos
              </Link>
              <Link
                to="/organizer/events/new"
                className="text-gray-800 hover:text-black transition-colors"
              >
                Create an Event
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-yellow-400/50 pt-6 text-center">
          <p className="text-gray-900 text-xs sm:text-sm font-medium">
            © 2025 Byblos Experience. All rights reserved.
          </p>
          <p className="text-gray-600 text-[10px] sm:text-xs mt-1 uppercase tracking-wider">
            Powered by EVOLVE
          </p>
        </div>
      </div>

      <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
    </footer>
  );
};

export default Footer;
