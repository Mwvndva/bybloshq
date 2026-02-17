import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { Instagram, Calendar, ShoppingBag, Shield, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBybx } from '@/contexts/BybxContext';
import { useSellerAuth } from '@/contexts/GlobalAuthContext';
import BybxImporter from './BybxImporter';

const Header = () => {
  const { onFileLoaded } = useBybx();
  const { isAuthenticated: isSellerAuthenticated } = useSellerAuth();
  const location = useLocation();

  return (
    <header className={cn(
      'sticky top-0 z-50 transition-all duration-300',
      'bg-white/5 backdrop-blur-xl border-b border-white/10'
    )}>
      <div className="w-full px-6 md:px-10 lg:px-12">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight group-hover:text-yellow-400 transition-colors">
              Byblos
            </h1>
          </Link>

          {/* Navigation - Always visible, responsive sizing */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* BYBX Importer */}
            {onFileLoaded && (
              <BybxImporter onFileLoaded={onFileLoaded} />
            )}

            {/* Event Organizer */}
            <Link to="/organizer/events/new">
              <Button
                variant="ghost"
                className="text-white hover:text-yellow-400 hover:bg-white/5 transition-all duration-300 flex items-center gap-2"
                aria-label="Event Organizer"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  Create Event
                </span>
              </Button>
            </Link>

            {/* Sell / Dashboard */}
            <Link to={isSellerAuthenticated ? "/seller/dashboard" : "/seller/register"}>
              <Button
                className="bg-white/10 hover:bg-white/20 text-white rounded-full px-6 transition-all duration-300 border border-white/10 hover:border-white/20 shadow-lg backdrop-blur-md"
                aria-label={isSellerAuthenticated ? "Seller Dashboard" : "Sell Products"}
              >
                {isSellerAuthenticated ? (
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                ) : (
                  <ShoppingBag className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline text-sm font-semibold tracking-wide uppercase">
                  {isSellerAuthenticated ? "Dashboard" : "Launch Your Brand"}
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
