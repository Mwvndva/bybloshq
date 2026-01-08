import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { Instagram, Calendar, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

const Header = () => {
  const location = useLocation();

  return (
    <header className={cn(
      'border-b border-yellow-300 sticky top-0 z-50',
      location.pathname === '/' ? 'bg-yellow-300' : 'bg-white/80 backdrop-blur-sm'
    )}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-serif text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-black">
              Byblos
            </h1>
          </Link>

          {/* Navigation - Always visible, responsive sizing */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/bybloshq"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full hover:bg-pink-50 transition-colors"
              aria-label="Visit our Instagram"
            >
              <Instagram className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-pink-600" />
            </a>

            {/* Event Organizer */}
            <Link to="/organizer/events/new">
              <Button
                variant="outline"
                className="h-9 sm:h-10 md:h-11 px-2.5 sm:px-3 md:px-4 border-2 border-black text-black hover:bg-black hover:text-yellow-300 transition-all duration-200"
                aria-label="Event Organizer"
              >
                <Calendar className="h-4 w-4 md:h-4 md:w-4" />
                <span className="hidden sm:inline ml-1.5 md:ml-2 text-xs sm:text-sm md:text-base font-semibold">
                  Organizer
                </span>
              </Button>
            </Link>

            {/* Sell */}
            <Link to="/seller">
              <Button
                variant="outline"
                className="h-9 sm:h-10 md:h-11 px-2.5 sm:px-3 md:px-4 border-2 border-black text-black hover:bg-black hover:text-yellow-300 transition-all duration-200"
                aria-label="Sell Products"
              >
                <ShoppingBag className="h-4 w-4 md:h-4 md:w-4" />
                <span className="hidden sm:inline ml-1.5 md:ml-2 text-xs sm:text-sm md:text-base font-semibold">
                  Sell
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
