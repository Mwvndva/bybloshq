import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { Instagram, Calendar, ShoppingBag, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between w-full">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-black hover:text-gray-600 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 mx-auto md:mx-0">
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-black">
              Byblos Experience
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <a 
              href="https://www.instagram.com/bybloshq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 text-pink-600 hover:text-pink-500 transition-colors"
              aria-label="Visit our Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <div className="flex items-center space-x-2">
              <Link to="/organizer/events/new">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-black text-black hover:bg-black/10 hover:text-black flex items-center gap-1 h-8 px-3"
                  aria-label="Organizer"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Organizer</span>
                </Button>
              </Link>
              <Link to="/seller">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-black text-black hover:bg-black/10 hover:text-black flex items-center gap-1 h-8 px-3"
                  aria-label="Sell Clothes"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Sell</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            'md:hidden transition-all duration-300 ease-in-out overflow-hidden',
            isOpen ? 'max-h-48 mt-4' : 'max-h-0 mt-0'
          )}
        >
          <div className="flex flex-col space-y-4 py-4 border-t border-gray-200 mt-4">
            <a 
              href="https://www.instagram.com/bybloshq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-pink-600 hover:text-pink-500 px-2 py-2 text-base"
            >
              <Instagram className="h-5 w-5 mr-2" />
              Follow us on Instagram
            </a>
            <Link 
              to="/organizer/events/new"
              className="flex items-center text-black hover:bg-black/10 px-2 py-2 rounded text-base"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Event Organizer
            </Link>
            <Link 
              to="/seller"
              className="flex items-center text-black hover:bg-black/10 px-2 py-2 rounded text-base"
            >
              <ShoppingBag className="h-5 w-5 mr-2" />
              Sell Your Clothes
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
