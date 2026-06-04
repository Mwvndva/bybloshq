
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
interface HeroSectionProps {
  onExploreClick?: () => void;
}

const HeroSection = ({ onExploreClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-[#f8f7f2] py-24 sm:py-28 lg:py-32">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <Link to="/creator/login">
          <Button className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-900 shadow-[0_10px_28px_rgba(17,17,17,0.08)] transition-all duration-300 hover:bg-yellow-400 hover:text-black sm:px-5 sm:py-2.5 sm:text-sm">
            Creator
          </Button>
        </Link>
      </div>

      <div
        className="absolute inset-0 z-0 opacity-70"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f8f7f2 72%, #f3f1ea 100%)',
          backgroundColor: '#f8f7f2'
        }}
      />

      <div className="relative z-10 w-full px-4 sm:px-8 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center space-y-8 sm:space-y-10">

          <div className="space-y-5">
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-light text-stone-950 leading-none tracking-normal">
              BYBLOS
            </h1>

            <p className="text-lg sm:text-2xl md:text-3xl text-stone-700 font-light leading-tight tracking-normal">
              Give Your Business A Social Identity
            </p>

            <p className="mx-auto max-w-2xl text-sm sm:text-base text-stone-500 leading-7">
              Sell from Instagram, TikTok, or WhatsApp with trusted shop links, secure checkout, delivery support, and clean digital receipts.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
            <Link to="/buyer/login" className="w-full sm:w-auto">
              <Button
                className="w-full bg-white text-stone-950 hover:bg-stone-50 border border-stone-200 rounded-full px-6 py-5 text-base font-medium transition-all duration-300 shadow-[0_12px_35px_rgba(17,17,17,0.08)] group sm:w-auto sm:px-10 sm:py-6 sm:text-lg"
              >
                View Businesses
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/seller/register" className="w-full sm:w-auto">
              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black rounded-full px-6 py-5 text-base font-medium transition-all duration-300 shadow-[0_14px_30px_rgba(245,197,24,0.25)] group sm:w-auto sm:px-10 sm:py-6 sm:text-lg"
              >
                Become a Trusted Business
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
