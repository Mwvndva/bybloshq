import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

// The Byblos founder card renders at a fixed 1080x1920 (9:16) canvas — the exact
// aspect ratio of an Instagram Story / WhatsApp Status — then rasterizes to PNG
// for sharing. Never resize this markup directly; wrap it in <ScaledFounderCard>
// for on-screen preview and use exportCardAsPng() for the shareable file.
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

// Served from /public — same-origin so html-to-image can inline it at export time.
const LOGO_SRC = '/byblos-mark.png';

interface FounderCardProps {
  memberNumber: string | number;
  quote?: string;
  caption?: string;
  instagramHandle?: string;
}

export function FounderCard({
  memberNumber,
  quote = 'Buying on social media finally feels right.',
  caption = "Your money's held safe until your order shows up.",
  instagramHandle = '@byblosafrica',
}: FounderCardProps) {
  const formattedNumber =
    typeof memberNumber === 'number'
      ? memberNumber.toString().padStart(6, '0')
      : memberNumber;

  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        position: 'relative',
        background:
          'linear-gradient(155deg, #141310 0%, #0a0a09 55%, #000000 100%)',
        borderRadius: 34,
        border: '1px solid rgba(245,197,24,0.35)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        padding: '48px 56px',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
      }}
    >
      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 24,
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          height: 'calc(100% - 48px)',
          width: 'auto',
          opacity: 0.05,
          filter: 'grayscale(1) brightness(3)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <img src={LOGO_SRC} alt="Byblos" style={{ height: 44, width: 'auto', display: 'block' }} />
          <div
            style={{
              fontSize: 22,
              letterSpacing: '0.08em',
              color: '#f5c518',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            No. {formattedNumber}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 13,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: '#f5c518',
              fontWeight: 600,
            }}
          >
            Founder member
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            gap: 18,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              color: '#faf9f5',
              fontSize: 40,
              lineHeight: 1.28,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            {quote}
          </div>
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(250,249,245,0.58)',
              fontSize: 16,
              lineHeight: 1.4,
              fontWeight: 400,
              maxWidth: 480,
            }}
          >
            {caption}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.55 }}>
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="#faf9f5" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="4.8" stroke="#faf9f5" strokeWidth="1.8" />
            <circle cx="17.2" cy="6.8" r="1.1" fill="#faf9f5" />
          </svg>
          <div style={{ fontSize: 14, letterSpacing: '0.04em', color: 'rgba(250,249,245,0.55)', fontWeight: 500 }}>
            {instagramHandle}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Scales the fixed 1080x1920 canvas down to fit whatever container it is placed
 * in, without reflowing the card's internal layout. Render this on-screen (the
 * share-preview modal); rasterize the hidden full-scale node for the actual file.
 */
export function ScaledFounderCard(props: FounderCardProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const resize = () => {
      const containerWidth = outerRef.current?.offsetWidth ?? CARD_WIDTH;
      setScale(containerWidth / CARD_WIDTH);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (outerRef.current) observer.observe(outerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} style={{ width: '100%', height: CARD_HEIGHT * scale, overflow: 'hidden' }}>
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <FounderCard {...props} />
      </div>
    </div>
  );
}

/**
 * Renders the card off-screen at full 1080x1920 resolution (ignoring the preview
 * scale) and returns a PNG data URL, ready for the native share bridge. Always
 * call this against a dedicated hidden full-scale node.
 */
export async function exportCardAsPng(node: HTMLElement): Promise<string> {
  // Give the logo a chance to load so it is inlined into the raster.
  await new Promise((r) => setTimeout(r, 60));
  return toPng(node, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    pixelRatio: 1,
    cacheBust: true,
    style: { transform: 'none' },
  });
}

export const CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT;
