import { useEffect, useRef, useState } from 'react';
import { Instagram, Loader2, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FounderCard, ScaledFounderCard, exportCardAsPng } from './FounderCard';
import { useMembership, useJoinMembership } from './useMembership';
import { shareCardToInstagram, shareCardToWhatsApp } from '@/lib/socialShare';

type Step = 'invite' | 'celebrate';

// Suppress re-opening within a single app session (module-scoped, resets on cold
// start) so a buyer who taps "Maybe later" is not nagged repeatedly this session
// but still gets a gentle nudge next launch until they join.
let promptedThisSession = false;

interface MembershipGateProps {
  /** True once a buyer session exists (drives the status fetch + prompt). */
  enabled: boolean;
}

export function MembershipGate({ enabled }: MembershipGateProps) {
  const { data, isLoading } = useMembership(enabled);
  const joinMutation = useJoinMembership();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('invite');
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [sharing, setSharing] = useState<null | 'ig' | 'wa'>(null);

  // Full-resolution off-screen card, rasterized on first share and cached.
  const fullCardRef = useRef<HTMLDivElement>(null);
  const pngRef = useRef<string | null>(null);

  // Open the invite for a non-member who hasn't been prompted this session.
  useEffect(() => {
    if (!enabled || isLoading || !data) return;
    if (data.isMember || promptedThisSession) return;
    promptedThisSession = true;
    setStep('invite');
    setOpen(true);
  }, [enabled, isLoading, data]);

  const handleJoin = async () => {
    try {
      const result = await joinMutation.mutateAsync();
      pngRef.current = null; // number changed → invalidate any cached raster
      setMemberNumber(result.memberNumber);
      setStep('celebrate');
    } catch {
      toast({
        title: 'Could not activate membership',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (next: boolean) => {
    // Closing at the invite step counts as "Maybe later"; promptedThisSession
    // already prevents an immediate re-open.
    setOpen(next);
  };

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

  const displayNumber = memberNumber ?? data?.memberNumber ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-[#0a0a0a] text-white sm:rounded-3xl">
        {step === 'invite' ? (
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5c518]/12">
              <Sparkles className="h-7 w-7 text-[#f5c518]" />
            </span>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-black tracking-tight text-white">
                Become a Byblos member
              </DialogTitle>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-white/60">
                Get your own numbered founder card — proof you shop protected, and
                one of the first to do it. Yours to show off.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-white/45">
              <ShieldCheck className="h-4 w-4 text-[#f5c518]" />
              Every order held safe until it shows up
            </div>
            <div className="mt-1 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={handleJoin}
                disabled={joinMutation.isPending}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f5c518] text-sm font-bold text-black transition hover:bg-[#f5c518]/90 disabled:opacity-70"
              >
                {joinMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Yes, I'm in"
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-white/50 transition hover:text-white/80"
              >
                Maybe later
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-1 text-center">
            <DialogTitle className="text-lg font-black tracking-tight text-white">
              You’re member No. {String(displayNumber).padStart(6, '0')} 🎉
            </DialogTitle>
            <p className="-mt-1 text-xs text-white/55">Share your card and show you shop protected.</p>

            <div className="w-full max-w-[220px] overflow-hidden rounded-2xl">
              <ScaledFounderCard memberNumber={displayNumber} />
            </div>

            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => share('ig')}
                disabled={sharing !== null}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f5c518] text-sm font-bold text-black transition hover:bg-[#f5c518]/90 disabled:opacity-70"
              >
                {sharing === 'ig' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
                Share to Instagram Stories
              </button>
              <button
                type="button"
                onClick={() => share('wa')}
                disabled={sharing !== null}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-sm font-bold text-white transition hover:bg-white/12 disabled:opacity-70"
              >
                {sharing === 'wa' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Share to WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-white/45 transition hover:text-white/75"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Off-screen full-resolution card used only for PNG export. */}
        {step === 'celebrate' && (
          <div aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }}>
            <div ref={fullCardRef} style={{ width: 1080, height: 1920 }}>
              <FounderCard memberNumber={displayNumber} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MembershipGate;
