import { useRef, type TouchEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';

const SWIPE_UP_THRESHOLD_PX = 40;

/**
 * Contextual "add your business" entry pinned to the bottom of the landing page
 * (spec §1). It emerges from the bottom with rounded top corners; on Android the
 * hint is "Swipe up to add business" and an upward swipe (or tap) opens the
 * existing seller registration flow, on web it's a plain "Click here to add
 * business". Reuses the existing /seller/register route — no duplicate flow.
 */
export function AddBusinessCard() {
  const navigate = useNavigate();
  const native = isNativeApp();
  const startY = useRef<number | null>(null);

  const openRegistration = () => navigate('/seller/register');

  const handleTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    startY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    if (startY.current === null) return;
    const endY = event.changedTouches[0]?.clientY ?? startY.current;
    if (startY.current - endY > SWIPE_UP_THRESHOLD_PX) openRegistration();
    startY.current = null;
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <button
        type="button"
        onClick={openRegistration}
        onTouchStart={native ? handleTouchStart : undefined}
        onTouchEnd={native ? handleTouchEnd : undefined}
        aria-label="Add your business — open seller registration"
        className="flex w-full flex-col items-center gap-1 rounded-t-3xl border-x border-t border-black/10 bg-white px-6 pb-4 pt-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.18)] backdrop-blur transition-colors hover:bg-slate-50 dark:border-white/12 dark:bg-white/[0.06] dark:shadow-[0_-12px_34px_rgba(0,0,0,0.55)] dark:hover:bg-white/10"
      >
        <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-white/25" aria-hidden="true" />
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
          <ChevronUp className={`h-4 w-4 text-yellow-500 ${native ? 'animate-bounce' : ''}`} aria-hidden="true" />
          {native ? 'Swipe up to add business' : 'Click here to add business'}
        </span>
      </button>
    </div>
  );
}

export default AddBusinessCard;
