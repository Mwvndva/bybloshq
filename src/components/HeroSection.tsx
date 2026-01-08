
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeroSectionProps {
  onExploreClick?: () => void;
  onEventsClick: () => void;
}

const HeroSection = ({ onExploreClick, onEventsClick }: HeroSectionProps) => {
  const navigate = useNavigate();

  const handleStartThrifting = () => {
    navigate('/buyer/login');
  };
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-black/30 z-0" />
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(/herowallpaper/blackboredapewallpaper.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          imageRendering: 'crisp-edges',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          transformStyle: 'preserve-3d',
          willChange: 'transform'
        }}
      />

      <div className="container-mobile text-center relative z-10">
        <div className="max-w-4xl mx-auto mobile-compact-x">


          {/* Main Heading */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-yellow-500 mb-3 sm:mb-4 md:mb-6 font-mono">
            BYBLOS — JUST START
          </h1>

          {/* SEO Description */}
          <div className="mb-6 sm:mb-8 md:mb-12 max-w-3xl mx-auto">
            <p className="text-white mobile-text-lg mb-3 sm:mb-4">
              Kenya’s #1 interactive online marketplace.
              Everyone’s got a hustle — make yours official.
              Set up your shop in minutes, get your own link, take orders on WhatsApp, and deliver fast across Nairobi.
              No excuses. No stress. Just start.           </p>
            <div className="text-yellow-400 mobile-text">
              <p>✓ 100% Authentic Items</p>
              <p>✓ Delivery in Nairobi</p>
              <p>✓ Secure Online Payments</p>
              <p>✓ Your Business, All in One Link</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center mb-8 sm:mb-12 w-full">
            <Button
              onClick={handleStartThrifting}
              className="button-mobile bg-yellow-300 hover:bg-white hover:text-black text-black px-4 sm:px-6 font-medium transition-colors duration-200 w-full sm:w-auto"
            >
              Start Shopping
            </Button>
            <Button
              onClick={onEventsClick}
              variant="outline"
              className="button-mobile border-yellow-300 text-black hover:bg-yellow-300 hover:border-yellow-300 hover:text-black px-4 sm:px-6 font-medium transition-colors duration-200 w-full sm:w-auto"
            >
              View Events & Tickets
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
