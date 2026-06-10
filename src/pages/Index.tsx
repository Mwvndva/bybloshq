import HeroSection from '@/components/HeroSection';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { isNativeApp } from '@/lib/mobileApp';
import { Link } from 'react-router-dom';

const NativeAppHome = () => (
  <div className="relative flex min-h-[100svh] items-center justify-center bg-white px-6 py-10 text-stone-950 selection:bg-yellow-300 selection:text-black">
    <Link to="/creator/login" className="absolute right-5 top-5">
      <Button className="h-10 rounded-full border border-stone-200 bg-white px-5 text-xs font-black uppercase tracking-[0.14em] text-stone-950 shadow-[0_12px_30px_rgba(17,17,17,0.08)] hover:bg-stone-50">
        Creator
      </Button>
    </Link>
    <main className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
      <img
        src="/byblos-mark.png"
        alt="Byblos logo"
        className="h-auto w-[min(68vw,260px)]"
      />

      <div className="flex w-full flex-col gap-3">
        <Link to="/buyer/login" className="w-full">
          <Button className="h-[52px] w-full rounded-full border border-stone-200 bg-white text-sm font-semibold text-stone-950 shadow-[0_12px_30px_rgba(17,17,17,0.08)] hover:bg-stone-50">
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
    <div className="min-h-screen bg-[#f8f7f2] text-stone-950 flex flex-col selection:bg-yellow-300 selection:text-black">
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
