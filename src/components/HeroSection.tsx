
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
interface HeroSectionProps {
  onExploreClick?: () => void;
}

const HeroSection = ({ onExploreClick }: HeroSectionProps) => {
  const operatingLoop = [
    'Create shop',
    'Add products',
    'Share link',
    'Buyer pays',
    'Fulfill order',
    'Withdraw'
  ];

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-white py-20 sm:py-24 lg:py-28">
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
          background: '#ffffff',
          backgroundColor: '#ffffff'
        }}
      />

      <div className="relative z-10 w-full px-4 sm:px-8 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center space-y-7 sm:space-y-9">

          <div className="space-y-5">
            <img
              src="/byblos-mark.png"
              alt="Byblos logo"
              className="mx-auto h-auto w-[min(52vw,220px)] sm:w-[min(36vw,300px)] lg:w-[340px]"
            />

            <h1 className="text-2xl font-semibold leading-none tracking-normal text-stone-950 sm:text-4xl md:text-5xl lg:text-6xl">
              BYBLOS
            </h1>

            <p className="mx-auto max-w-4xl text-3xl font-extrabold leading-tight tracking-normal text-stone-950 sm:text-5xl md:text-6xl">
              Start and run your business in Nairobi.
            </p>

            <p className="mx-auto max-w-3xl text-sm leading-7 text-stone-600 sm:text-lg sm:leading-8">
              Create a trusted shop link, sell from Instagram, TikTok, or WhatsApp, collect secure payments, manage orders, delivery, receipts, refunds, and withdrawals in one place.
            </p>
          </div>

          <div className="grid w-full max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {operatingLoop.map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-stone-200 bg-white/85 px-3 py-3 text-left shadow-[0_12px_35px_rgba(17,17,17,0.06)] backdrop-blur-sm"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-bold text-stone-950 sm:text-base">
                  {step}
                </p>
              </div>
            ))}
          </div>

          <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
            <Link to="/buyer/login" className="w-full sm:w-auto">
              <Button
                className="w-full bg-white text-stone-950 hover:bg-stone-50 border border-stone-200 rounded-full px-6 py-5 text-base font-medium transition-all duration-300 shadow-[0_12px_35px_rgba(17,17,17,0.08)] group sm:w-auto sm:px-10 sm:py-6 sm:text-lg"
              >
                Browse Trusted Shops
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/seller/register" className="w-full sm:w-auto">
              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black rounded-full px-6 py-5 text-base font-medium transition-all duration-300 shadow-[0_14px_30px_rgba(245,197,24,0.25)] group sm:w-auto sm:px-10 sm:py-6 sm:text-lg"
              >
                Start Selling
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <p className="max-w-2xl text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Trust infrastructure for Nairobi social businesses
          </p>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
