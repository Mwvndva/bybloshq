import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

// LOCKED DESIGN — mirrors byblos_card_locked_spec.html. The Byblos founder card
// is a literal card at a FIXED 900x566 (real card proportions, ~1.59:1). It must
// never stretch: the root carries explicit width/height + flexShrink 0, and any
// resizing is done by scaling the whole card via CSS transform (see
// <ScaledFounderCard>), never by changing its internal width/height or letting a
// parent flex/grid stretch it. Do not alter colors, spacing, font sizes, or
// proportions here without an explicit request.
//
// MANDATORY INTEGRATION INSTRUCTIONS:
// 1. Wrap with ScaledFounderCard, never FounderCard directly, in any container with unknown/fluid width.
// 2. Any flex or grid ancestor wrapping the card needs min-width: 0 (Tailwind: min-w-0) on the item containing it — this is not optional. If a future integration point stretches again, check this first before touching the component itself.
const CARD_WIDTH = 900;
const CARD_HEIGHT = 566;

// The 9:16 canvas the card is composited onto for a Story / Status share.
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

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
      className="byblos-card-root"
      style={{
        // LOCKED: exact card proportions. Never stretch / never use %.
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        flexShrink: 0,
        boxSizing: 'border-box',
        position: 'relative',
        background: 'linear-gradient(155deg, #141310 0%, #0a0a09 55%, #000000 100%)',
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
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <img src={LOGO_SRC} alt="Byblos" style={{ height: 44, width: 'auto', display: 'block' }} />
          <div style={{ textAlign: 'right' }}>
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
            Founder Member
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
              whiteSpace: 'nowrap', // LOCKED: hero line must stay on one line
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
 * Composites the fixed-size landscape card onto a 1080x1920 (9:16) story canvas so
 * the shared Instagram Story / WhatsApp Status fills the screen with the card
 * centre-stage. The card keeps its exact 900x566 dimensions (no stretch). This is
 * the node handed to exportCardAsPng().
 */
export function StoryShareFrame(props: FounderCardProps) {
  return (
    <div
      style={{
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 72,
        padding: '120px 64px',
        background:
          'radial-gradient(120% 80% at 50% 18%, #16150f 0%, #0a0908 55%, #000000 100%)',
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <img src={LOGO_SRC} alt="Byblos" style={{ height: 52, width: 'auto', display: 'block', margin: '0 auto', opacity: 0.9 }} />
        <div style={{ marginTop: 22, fontSize: 30, fontWeight: 700, color: '#faf9f5', letterSpacing: '-0.01em' }}>
          I just joined Byblos
        </div>
      </div>

      <FounderCard {...props} />

      <div
        style={{
          textAlign: 'center',
          color: 'rgba(250,249,245,0.6)',
          fontSize: 26,
          fontWeight: 500,
          lineHeight: 1.45,
          maxWidth: 760,
        }}
      >
        Shop protected — your money is held safe until your order shows up.
        <div style={{ marginTop: 10, color: '#f5c518', fontWeight: 700 }}>bybloshq.space</div>
      </div>
    </div>
  );
}

/**
 * Scales the fixed 900x566 card down to fit whatever container it is placed in,
 * WITHOUT reflowing the card's internal layout (transform: scale only, ratio
 * preserved). Render this on-screen; rasterize the hidden full-scale
 * <StoryShareFrame> for the actual file.
 */
export function ScaledFounderCard(props: FounderCardProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.333);

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
 * Renders the story frame off-screen at full 1080x1920 resolution (ignoring the
 * preview scale) and returns a PNG data URL, ready for the native share bridge.
 * Always call this against a dedicated hidden full-scale <StoryShareFrame> node.
 */
export async function exportCardAsPng(node: HTMLElement): Promise<string> {
  // Give the logo a chance to load so it is inlined into the raster.
  await new Promise((r) => setTimeout(r, 60));
  return toPng(node, {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    pixelRatio: 1,
    cacheBust: true,
    style: { transform: 'none' },
  });
}

export const CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT;
export const STORY_SIZE = { width: STORY_WIDTH, height: STORY_HEIGHT };
