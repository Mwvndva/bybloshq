import { Button } from '@/shared/ui/button';
import { AddBusinessCard } from '@/features/shop/components/AddBusinessCard';
import { useGlobalAuth } from '@/features/auth/hooks/useGlobalAuth';
import { Link, Navigate } from 'react-router-dom';

/**
 * The single Byblos landing screen, shared by web and the Android app: a centred
 * logo that is itself the buyer entry point, with a contextual "add business"
 * card emerging from the bottom. Delivery partners and creators get discreet
 * corner entries.
 */
const LandingHome = () => (
  <div className="relative flex min-h-[100svh] items-center justify-center bg-[var(--byblos-bg,#000000)] px-6 py-10 text-[var(--byblos-text,#f5f5f5)] selection:bg-yellow-300 selection:text-black transition-colors duration-200">
    {/* Mzigo Ego delivery partners get a discreet entry — the logo is the button. */}
    <Link to="/mzigo/login" className="absolute left-5 top-[calc(1.25rem+env(safe-area-inset-top,0px))]" aria-label="Mzigo Ego delivery partner login">
      <Button className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.06] p-0 shadow-sm hover:bg-black/[0.08] dark:hover:bg-white/10">
        <img src="/mzigo-ego.png" alt="Mzigo Ego" className="h-6 w-6 object-contain" />
      </Button>
    </Link>

    <Link to="/creator/login" className="absolute right-5 top-[calc(1.25rem+env(safe-area-inset-top,0px))]">
      <Button className="h-7 rounded-full border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.06] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-white shadow-sm hover:bg-black/[0.08] dark:hover:bg-white/10">
        Creator
      </Button>
    </Link>

    <main className="flex w-full max-w-sm flex-col items-center gap-6 text-center pt-[env(safe-area-inset-top,0px)] pb-28">
      {/* The centre logo is the buyer entry point — tapping it opens buyer login. */}
      <Link
        to="/buyer/login"
        aria-label="Tap the Byblos logo to get access"
        className="overflow-hidden rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-400/70"
      >
        <img
          src="/byblos-mark-dark.png"
          alt="Byblos logo"
          className="hidden dark:block h-auto w-[min(68vw,260px)] object-cover"
        />
        <img
          src="/byblos-mark-light.png"
          alt="Byblos logo"
          className="block dark:hidden h-auto w-[min(68vw,260px)] object-cover"
        />
      </Link>

      <p className="text-xs font-semibold tracking-wide text-slate-600 dark:text-white/80 max-w-[280px] leading-relaxed">
        The safer way to buy from businesses on social media
      </p>

      <p className="text-[13px] font-bold tracking-wide text-slate-800 dark:text-white/90">
        Tap logo to get access
      </p>
    </main>

    <AddBusinessCard />
  </div>
);

const IndexPage = () => {
  const { user } = useGlobalAuth();

  // An authenticated Mzigo Ego courier lands straight on their deliveries.
  if (user?.role === 'logistics' && user.isAuthenticated) {
    return <Navigate to="/mzigo/dashboard" replace />;
  }

  return <LandingHome />;
};

export default IndexPage;
