import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';
import { useState } from 'react';
import TermsModal from './TermsModal';

const Footer = () => {
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  return (
    <footer className="bg-yellow-300 border-t-4 border-yellow-400">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Location */}
          <div>
            <h3 className="font-bold text-black mb-4 text-lg flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Location
            </h3>
            <p className="text-gray-800 text-sm leading-relaxed">
              Nairobi, Kenya
              <br />
              East Africa
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-black mb-4 text-lg">Contact Us</h3>
            <div className="space-y-2 text-sm">
              <a 
                href="mailto:byblosexperience@zohomail.com" 
                className="flex items-center text-gray-800 hover:text-black transition-colors"
              >
                <Mail className="h-4 w-4 mr-2" />
                byblosexperience@zohomail.com
              </a>
              <a 
                href="tel:+254111548797" 
                className="flex items-center text-gray-800 hover:text-black transition-colors"
              >
                <Phone className="h-4 w-4 mr-2" />
                +254 111 548 797
              </a>
              <a 
                href="https://www.instagram.com/bybloshq" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-gray-800 hover:text-pink-600 transition-colors"
              >
                <Instagram className="h-4 w-4 mr-2" />
                @bybloshq
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-bold text-black mb-4 text-lg">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <button 
                onClick={() => setIsTermsModalOpen(true)}
                className="block text-gray-800 hover:text-black transition-colors cursor-pointer text-left"
              >
                Terms & Conditions
              </button>
              <Link 
                to="/seller" 
                className="block text-gray-800 hover:text-black transition-colors"
              >
                Sell on Byblos
              </Link>
              <Link 
                to="/organizer/events/new" 
                className="block text-gray-800 hover:text-black transition-colors"
              >
                Create an Event
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-yellow-400 pt-6 text-center">
          <p className="text-gray-800 text-sm">
            © 2025 Byblos Experience. All rights reserved.
          </p>
        </div>
      </div>

      <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
    </footer>
  );
};

export default Footer;
