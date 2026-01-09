import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';
import { useState } from 'react';
import TermsModal from './TermsModal';

const Footer = () => {
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  return (
    <footer className="bg-yellow-300 border-t-4 border-yellow-400">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-8 lg:gap-6 mb-8 text-center md:text-left">
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

            {/* Powered by EVOLVE */}
            <div className="mt-6 space-y-2">
              <h3 className="font-bold text-black text-lg">Powered by EVOLVE</h3>
              <p className="text-gray-800 text-sm">
                © 2025 Byblos Experience. All rights reserved.
              </p>
            </div>
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

          {/* Partners */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-bold text-black mb-3 text-lg">Partners</h3>
            <div className="flex flex-col gap-3 items-center md:items-start text-sm">
              <div className="font-semibold text-black px-4 py-2 rounded-lg border-2 border-yellow-400 bg-white">
                Mzigo Ego
              </div>
              <div className="font-semibold text-black px-4 py-2 rounded-lg border-2 border-yellow-400 bg-white">
                Payd
              </div>
            </div>
          </div>
        </div>
      </div>

      <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
    </footer>
  );
};

export default Footer;
