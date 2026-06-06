
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
    <section className="relative flex min-h-[calc(100svh-88px)] items-center justify-center overflow-hidden bg-white py-10 sm:min-h-[calc(100svh-73px)] sm:py-12 lg:py-14">
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
        <div className="mx-auto flex max-w-6xl flex-col items-center space-y-4 text-center sm:space-y-5 lg:space-y-6">

          <div className="space-y-3 sm:space-y-4">
            <img
              src="/byblos-mark.png"
              alt="Byblos logo"
              className="mx-auto h-auto w-[min(42vw,150px)] sm:w-[min(24vw,220px)] lg:w-[260px]"
            />

            <p className="mx-auto max-w-4xl text-2xl font-extrabold leading-tight tracking-normal text-stone-950 sm:text-4xl md:text-5xl">
              Start and run your business in Nairobi.
            </p>

            <p className="mx-auto max-w-3xl text-xs leading-5 text-stone-600 sm:text-sm sm:leading-6 md:text-base">
              Create a trusted shop link, sell from Instagram, TikTok, or WhatsApp, collect secure payments, manage orders, delivery, receipts, refunds, and withdrawals in one place.
            </p>
          </div>

          <div className="grid w-full max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {operatingLoop.map((step, index) => (
              <div
                key={step}
                className="rounded-xl border border-stone-200 bg-white/85 px-2.5 py-2 text-left shadow-[0_10px_28px_rgba(17,17,17,0.05)] backdrop-blur-sm sm:px-3"
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-yellow-600">
                  Step {index + 1}
                </p>
                <p className="mt-0.5 text-xs font-bold text-stone-950 sm:text-sm">
                  {step}
                </p>
              </div>
            ))}
          </div>

          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Link to="/buyer/login" className="w-full sm:w-auto">
              <Button
                className="group w-full rounded-full border border-stone-200 bg-white px-5 py-4 text-sm font-medium text-stone-950 shadow-[0_10px_28px_rgba(17,17,17,0.07)] transition-all duration-300 hover:bg-stone-50 sm:w-auto sm:px-8 sm:py-5 sm:text-base"
              >
                Browse Trusted Shops
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/seller/register" className="w-full sm:w-auto">
              <Button
                className="group w-full rounded-full bg-yellow-400 px-5 py-4 text-sm font-medium text-black shadow-[0_12px_28px_rgba(245,197,24,0.22)] transition-all duration-300 hover:bg-yellow-300 sm:w-auto sm:px-8 sm:py-5 sm:text-base"
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
