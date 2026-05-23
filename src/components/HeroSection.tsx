
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck, Store, Truck } from 'lucide-react';
interface HeroSectionProps {
  onExploreClick?: () => void;
}

const HeroSection = ({ onExploreClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[82dvh] flex items-center justify-center overflow-hidden bg-[#f8f7f2]">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <Link to="/creator/login">
          <Button className="rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 shadow-[0_10px_28px_rgba(17,17,17,0.08)] transition-all duration-300 hover:bg-yellow-400 hover:text-black">
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

      <div
        className="absolute inset-0 z-0 opacity-[0.45] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#e7e2d6 1px, transparent 1px), linear-gradient(90deg, #e7e2d6 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 72%, transparent)',
        }}
      />

      <div className="relative z-10 w-full px-6 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center space-y-10">

          <div className="space-y-5">
            <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-yellow-600" />
              Trusted checkout for social businesses
            </div>

            <h1 className="text-6xl sm:text-7xl md:text-9xl font-light text-stone-950 leading-none tracking-normal">
              BYBLOS
            </h1>

            <p className="text-xl sm:text-2xl md:text-3xl text-stone-700 font-light leading-tight tracking-normal">
              Give Your Business A Social Identity
            </p>

            <p className="mx-auto max-w-2xl text-sm sm:text-base text-stone-500 leading-7">
              Sell from Instagram, TikTok, or WhatsApp with trusted shop links, secure checkout, delivery support, and clean digital receipts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link to="/buyer/login">
              <Button
                className="bg-white text-stone-950 hover:bg-stone-50 border border-stone-200 rounded-full px-10 py-6 text-lg font-medium transition-all duration-300 shadow-[0_12px_35px_rgba(17,17,17,0.08)] group"
              >
                View Businesses
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/seller/register">
              <Button
                className="bg-yellow-400 hover:bg-yellow-300 text-black rounded-full px-10 py-6 text-lg font-medium transition-all duration-300 shadow-[0_14px_30px_rgba(245,197,24,0.25)] group"
              >
                Become a Trusted Business
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, label: 'Escrow protected', copy: 'Buyers trust you faster.' },
              { icon: Truck, label: 'Door delivery', copy: 'Orders move with less stress.' },
              { icon: Store, label: 'Beautiful shop links', copy: 'Your page looks more professional.' }
            ].map(({ icon: Icon, label, copy }) => (
              <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-[0_10px_28px_rgba(17,17,17,0.06)]">
                <Icon className="mb-3 h-5 w-5 text-yellow-600" />
                <h3 className="text-sm font-semibold text-stone-950">{label}</h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">{copy}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
