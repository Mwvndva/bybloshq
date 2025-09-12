
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
          backgroundImage: 'url(/herowallpaper/blackboredapewallpaper.png)',
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

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
        
          {/* Main Heading */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-yellow-500 mb-8 sm:mb-12 font-mono">
            HAVE YOU EVER BEEN TO BYBLOS?
          </h1>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 w-full">
            <Button 
              onClick={handleStartThrifting}
              className="bg-yellow-300 hover:bg-white hover:text-black text-black px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg font-medium transition-colors duration-200 w-full sm:w-auto"
            >
              Start Thrifting
            </Button>
            <Button 
              onClick={onEventsClick}
              variant="outline"
              className="border-yellow-300 text-black hover:bg-yellow-300 hover:border-yellow-300 hover:text-black px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg font-medium transition-colors duration-200 w-full sm:w-auto"
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
