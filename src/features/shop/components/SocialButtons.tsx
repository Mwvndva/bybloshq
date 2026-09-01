import type { MouseEvent } from 'react';
import { cn } from '@/shared/utils/formatting';
import instagramLogo from '@/assets/social/instagram.png';
import tiktokLogo from '@/assets/social/tiktok.png';

interface SocialButtonsProps {
  instagramHref: string | null;
  tiktokHref: string | null;
  shopName?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const stop = (e: MouseEvent) => e.stopPropagation();

/**
 * Instagram + TikTok logo buttons, side by side on one row. A missing link still
 * renders as a disabled (greyed, non-clickable) logo rather than an empty gap —
 * used by the seller shop card and the shop hero.
 */
export function SocialButtons({ instagramHref, tiktokHref, shopName = 'Shop', size = 'md', className }: SocialButtonsProps) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const pad = size === 'sm' ? 'p-1.5' : 'p-2';
  const base = 'inline-flex items-center justify-center rounded-full border shadow-sm transition-all';
  const enabled = 'border-[var(--byblos-border,rgba(255,255,255,0.14))] bg-[var(--byblos-surface-soft,rgba(255,255,255,0.06))] hover:opacity-80';
  const disabled = 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-35';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {instagramHref ? (
        <a href={instagramHref} target="_blank" rel="noopener noreferrer" onClick={stop} aria-label={`${shopName} on Instagram`} className={cn(base, enabled, pad)}>
          <img src={instagramLogo} alt="" className={cn(dim, 'object-contain')} />
        </a>
      ) : (
        <span aria-label="Instagram not available" aria-disabled="true" className={cn(base, disabled, pad)}>
          <img src={instagramLogo} alt="" className={cn(dim, 'object-contain grayscale')} />
        </span>
      )}

      {tiktokHref ? (
        <a href={tiktokHref} target="_blank" rel="noopener noreferrer" onClick={stop} aria-label={`${shopName} on TikTok`} className={cn(base, enabled, pad)}>
          <img src={tiktokLogo} alt="" className={cn(dim, 'object-contain')} />
        </a>
      ) : (
        <span aria-label="TikTok not available" aria-disabled="true" className={cn(base, disabled, pad)}>
          <img src={tiktokLogo} alt="" className={cn(dim, 'object-contain grayscale')} />
        </span>
      )}
    </div>
  );
}

export default SocialButtons;
