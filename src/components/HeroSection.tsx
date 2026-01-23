
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
    <section className="relative flex items-center justify-center min-h-[75vh] overflow-hidden py-10 sm:py-14 md:py-16">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: 'url(/herowallpaper/blackboredapewallpaper.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Dark overlay for better text contrast */}
      <div className="absolute inset-0 bg-black/60 z-0 backdrop-blur-[2px]" />

      <div className="container-mobile relative z-10 w-full">
        <div className="max-w-5xl mx-auto mobile-compact-x">

          {/* Glassmorphism Card */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 sm:p-10 md:p-14 shadow-2xl relative overflow-hidden group">

            {/* Subtle glow effects inside the card */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-yellow-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-pink-500/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 text-center space-y-6 sm:space-y-8">

              {/* Main Heading */}
              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white font-mono tracking-tighter leading-none animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
                  BYBLOS
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 mt-1 sm:mt-2">
                    JUST START.
                  </span>
                </h1>
              </div>

              {/* Description */}
              <p className="text-gray-200 mobile-text-lg max-w-2xl mx-auto leading-relaxed font-light animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                The operating system for digital shops.
                <br className="hidden sm:block" />
                Auto-order notifications, instant M-Pesa payments, and zero stress delivery.
              </p>

              {/* Features Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto py-4 sm:py-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                {[
                  "100% Authentic",
                  "Nairobi Delivery",
                  "Secure Payments",
                  "One Link Shop"
                ].map((feature, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-2 sm:p-3 backdrop-blur-sm">
                    <p className="text-yellow-300 text-xs sm:text-sm font-semibold whitespace-nowrap">✓ {feature}</p>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center w-full animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
                <Button
                  onClick={handleStartThrifting}
                  className="group relative overflow-hidden bg-yellow-400 hover:bg-yellow-300 text-black px-8 py-6 rounded-xl text-lg font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(250,204,21,0.5)] w-full sm:w-auto"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Start Shopping
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>

                <Button
                  onClick={onEventsClick}
                  className="group border-2 border-white/20 bg-black/50 hover:bg-black/70 text-white px-8 py-6 rounded-xl text-lg font-bold transition-all duration-300 backdrop-blur-sm w-full sm:w-auto"
                >
                  <span className="flex items-center justify-center gap-2">
                    View Events
                    <Ticket className="w-5 h-5 transition-transform group-hover:rotate-12" />
                  </span>
                </Button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
