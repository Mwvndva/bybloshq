
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Ticket } from 'lucide-react';

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
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-black">
      {/* Background with deep blur and subtle movement */}
      <div
        className="absolute inset-0 z-0 opacity-40 scale-110"
        style={{
          backgroundImage: 'url(/herowallpaper/blackboredapewallpaper.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(40px)',
        }}
      />

      {/* Dynamic light blobs for depth */}
      <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-yellow-400/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[25rem] h-[25rem] bg-pink-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none delay-1000" />

      <div className="container-mobile relative z-10 w-full px-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center space-y-12">

          {/* Main Title Group */}
          <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-medium text-white leading-[1.1] tracking-tight animate-in fade-in slide-in-from-bottom-5 duration-1000">
              The Operating System for <br />
              <span className="italic font-serif text-yellow-300/90">Digital Shops.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-light leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              Welcome to the Future of Window Shopping.
            </p>
          </div>

          {/* Minimal CTA Group */}
          <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
            <Button
              onClick={handleStartThrifting}
              className="bg-white text-black hover:bg-yellow-300 text-black rounded-full px-12 py-7 text-lg font-medium transition-all duration-500 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-yellow-300/20"
            >
              Get a Window
            </Button>

            <button
              onClick={onEventsClick}
              className="text-white/80 hover:text-white transition-colors duration-300 flex items-center gap-2 group text-lg"
            >
              Explore Events
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Glass Verification Badges - Minimal Version */}
          <div className="pt-12 flex flex-wrap justify-center gap-8 opacity-40 hover:opacity-100 transition-opacity duration-700">
            {["100% Authentic", "Verified Nairobi Shops", "Secure Escrow"].map((item, i) => (
              <span key={i} className="text-white/60 text-xs uppercase tracking-[0.2em] font-medium">
                {item}
              </span>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
