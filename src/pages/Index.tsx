import HeroSection from '@/components/HeroSection';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { isNativeApp } from '@/lib/mobileApp';
import { Link } from 'react-router-dom';

const NativeAppHome = () => (
  <div className="relative flex min-h-[100svh] items-center justify-center bg-black px-6 py-10 text-white selection:bg-yellow-300 selection:text-black">
    <Link to="/creator/login" className="absolute right-5 top-5">
      <Button className="h-10 rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_12px_30px_rgba(0,0,0,0.5)] hover:bg-white/10">
        Ambassador
      </Button>
    </Link>
    <main className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
      <img
        src="/byblos-icon.png"
        alt="Byblos logo"
        className="h-auto w-[min(68vw,260px)]"
      />

      <div className="flex w-full flex-col gap-3">
        <Link to="/buyer/login" className="w-full">
          <Button className="h-[52px] w-full rounded-full border border-white/15 bg-white/[0.06] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.5)] hover:bg-white/10">
            Browse trusted shops
          </Button>
        </Link>

        <Link to="/seller/register" className="w-full">
          <Button className="h-[52px] w-full rounded-full bg-yellow-400 text-sm font-semibold text-black shadow-[0_14px_30px_rgba(245,197,24,0.24)] hover:bg-yellow-300">
            Start selling
          </Button>
        </Link>
      </div>
    </main>
  </div>
);

const IndexPage = () => {
  const handleExploreClick = () => {
    // This can be left empty or can scroll to content if needed
  };

  if (isNativeApp()) {
    return <NativeAppHome />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-yellow-300 selection:text-black">
      <main className="flex-grow">
        <HeroSection
          onExploreClick={handleExploreClick}
        />
      </main>

      <Footer />
    </div>
  );
};

export default IndexPage;
