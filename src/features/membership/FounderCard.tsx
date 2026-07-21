import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

// The Byblos founder card is a *literal* card — landscape, credit-card
// proportions (close to ISO ID-1, ~1.586:1) rendered at a fixed 1080x680 canvas.
// For sharing it is centred on a 9:16 story frame (see <StoryShareFrame>) so an
// Instagram Story / WhatsApp Status still fills the screen. Never resize this
// markup directly; wrap it in <ScaledFounderCard> for on-screen preview.
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 680;

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
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        position: 'relative',
        background:
          'linear-gradient(135deg, #1c1a15 0%, #0f0e0b 52%, #050504 100%)',
        borderRadius: 48,
        border: '1px solid rgba(245,197,24,0.38)',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 90px rgba(0,0,0,0.6)',
        padding: '64px 72px',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
      }}
    >
      {/* Faint oversized watermark bleeding off the right edge, like a real card. */}
      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -120,
          bottom: -140,
          height: 620,
          width: 'auto',
          opacity: 0.05,
          filter: 'grayscale(1) brightness(3)',
          pointerEvents: 'none',
        }}
      />
      {/* Warm sheen in the top-left corner. */}
      <div
        style={{
          position: 'absolute',
          top: -160,
          left: -120,
          width: 520,
          height: 520,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(245,197,24,0.16) 0%, rgba(245,197,24,0) 68%)',
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
        {/* Header row: brand mark + member number, as on a bank card. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src={LOGO_SRC} alt="Byblos" style={{ height: 54, width: 'auto', display: 'block' }} />
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.34em',
                textTransform: 'uppercase',
                color: 'rgba(245,197,24,0.7)',
                fontWeight: 600,
              }}
            >
              Member
            </div>
            <div
              style={{
                fontSize: 30,
                letterSpacing: '0.1em',
                color: '#f5c518',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 4,
              }}
            >
              No. {formattedNumber}
            </div>
          </div>
        </div>

        {/* The line that carries the card. */}
        <div style={{ maxWidth: 760 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 13,
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              color: '#f5c518',
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            Founder member
          </span>
          <div
            style={{
              color: '#faf9f5',
              fontSize: 44,
              lineHeight: 1.22,
              fontWeight: 600,
              letterSpacing: '-0.015em',
            }}
          >
            {quote}
          </div>
        </div>

        {/* Footer: reassurance line + handle. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div
            style={{
              color: 'rgba(250,249,245,0.6)',
              fontSize: 18,
              lineHeight: 1.4,
              fontWeight: 400,
              maxWidth: 560,
            }}
          >
            {caption}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.6 }}>
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="#faf9f5" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4.8" stroke="#faf9f5" strokeWidth="1.8" />
              <circle cx="17.2" cy="6.8" r="1.1" fill="#faf9f5" />
            </svg>
            <div style={{ fontSize: 16, letterSpacing: '0.04em', color: 'rgba(250,249,245,0.6)', fontWeight: 500 }}>
              {instagramHandle}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Composites the landscape card onto a 1080x1920 (9:16) story canvas so the
 * shared Instagram Story / WhatsApp Status fills the screen with the card
 * floating centre-stage. This is the node handed to exportCardAsPng().
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
        gap: 64,
        padding: '120px 64px',
        background:
          'radial-gradient(120% 80% at 50% 18%, #16150f 0%, #0a0908 55%, #000000 100%)',
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <img src={LOGO_SRC} alt="Byblos" style={{ height: 52, width: 'auto', display: 'block', margin: '0 auto', opacity: 0.9 }} />
        <div
          style={{
            marginTop: 22,
            fontSize: 30,
            fontWeight: 700,
            color: '#faf9f5',
            letterSpacing: '-0.01em',
          }}
        >
          I just joined Byblos
        </div>
      </div>

      {/* The card, tilted a touch so it reads as an object, not a banner. */}
      <div style={{ transform: 'rotate(-2.5deg)', filter: 'drop-shadow(0 50px 90px rgba(0,0,0,0.55))' }}>
        <FounderCard {...props} />
      </div>

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
 * Scales the fixed landscape card down to fit whatever container it is placed in,
 * without reflowing the card's internal layout. Render this on-screen (the
 * share-preview modal); rasterize the hidden full-scale <StoryShareFrame> for the
 * actual file.
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
