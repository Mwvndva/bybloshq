import { useRef, useState } from 'react';
import { Instagram, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import { ScaledFounderCard, StoryShareFrame, exportCardAsPng } from '@/features/membership/FounderCard';
import { useMembership, useJoinMembership } from '@/features/membership/useMembership';
import { shareCardToInstagram, shareCardToWhatsApp } from '@/lib/socialShare';
import { useToast } from '@/hooks/use-toast';

/**
 * Buyer-settings surface for the founder card: lets a member view their card and
 * share it to Instagram / WhatsApp at any time (not just the one-time celebrate
 * popup), and lets a non-member mint theirs on the spot. Rasterizes the same
 * off-screen 9:16 <StoryShareFrame> used by the celebrate flow.
 */
export function BuyerMembershipCard() {
  const { data, isLoading } = useMembership(true);
  const joinMutation = useJoinMembership();
  const { toast } = useToast();

  const [sharing, setSharing] = useState<null | 'ig' | 'wa'>(null);
  const fullCardRef = useRef<HTMLDivElement>(null);
  const pngRef = useRef<string | null>(null);

  const isMember = Boolean(data?.isMember);
  const displayNumber = data?.memberNumber ?? 0;

  const ensurePng = async (): Promise<string> => {
    if (pngRef.current) return pngRef.current;
    const node = fullCardRef.current;
    if (!node) throw new Error('Card not ready');
    const url = await exportCardAsPng(node);
    pngRef.current = url;
    return url;
  };

  const share = async (target: 'ig' | 'wa') => {
    setSharing(target);
    try {
      const png = await ensurePng();
      if (target === 'ig') await shareCardToInstagram(png);
      else await shareCardToWhatsApp(png);
    } catch {
      toast({
        title: 'Sharing failed',
        description: 'We could not open the share screen. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSharing(null);
    }
  };

  const handleJoin = async () => {
    try {
      pngRef.current = null; // number about to change → invalidate any cached raster
      await joinMutation.mutateAsync();
    } catch {
      toast({
        title: 'Could not activate membership',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    }
  };

  // Don't flash the section before we know the membership state.
  if (isLoading) return null;

  return (
    <section className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#F5C518]" />
        <h3 className="text-sm font-semibold text-white">Founder card</h3>
      </div>

      {isMember ? (
        <>
          <p className="text-xs text-white/50">
            You're member No. {String(displayNumber).padStart(6, '0')} — share your card anytime.
          </p>

          <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl">
            <ScaledFounderCard memberNumber={displayNumber} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => share('ig')}
              disabled={sharing !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F5C518] text-sm font-bold text-black transition hover:bg-[#F5C518]/90 disabled:opacity-70"
            >
              {sharing === 'ig' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
              Instagram
            </button>
            <button
              type="button"
              onClick={() => share('wa')}
              disabled={sharing !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-sm font-bold text-white transition hover:bg-white/12 disabled:opacity-70"
            >
              {sharing === 'wa' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              WhatsApp
            </button>
          </div>

          {/* Off-screen full-resolution 9:16 story frame — used only for PNG
              export via html-to-image. Kept out of view with opacity:0 + z-index
              rather than an extreme left offset, because some WebKit/Safari
              builds fail to resolve computed styles for elements far outside the
              viewport (producing a blank or logo-less exported PNG). */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              opacity: 0,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          >
            <div ref={fullCardRef} style={{ width: 1080, height: 1920 }}>
              <StoryShareFrame memberNumber={displayNumber} />
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-white/50">
            Get your own numbered founder card — proof you shop protected, and one of the first to do it.
          </p>
          <button
            type="button"
            onClick={handleJoin}
            disabled={joinMutation.isPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5C518] text-sm font-bold text-black transition hover:bg-[#F5C518]/90 disabled:opacity-70"
          >
            {joinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Get my founder card
          </button>
        </>
      )}
    </section>
  );
}

export default BuyerMembershipCard;
