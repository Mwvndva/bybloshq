import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Hand-drawn-style line icons for the landing page's decorative doodles.
 * Deliberately sketch-like (rounded joins, slightly loose curves) rather than
 * crisp geometric icons, so they read as playful doodles, not UI glyphs.
 */
function HeartDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 20 C 6 15, 2 11, 2 7.2 C 2 3.8, 5.8 1.8, 8.6 3.6 C 10 4.5, 11.2 6, 12 7.4 C 12.8 6, 14 4.5, 15.4 3.6 C 18.2 1.8, 22 3.8, 22 7.2 C 22 11, 18 15, 12 20 Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 2.5 L14.6 9.2 L21.5 9.6 L16 14 L18 21 L12 17 L6 21 L8 14 L2.5 9.6 L9.4 9.2 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 L13.8 9.2 L21 11 L13.8 12.8 L12 20 L10.2 12.8 L3 11 L10.2 9.2 Z" />
    </svg>
  );
}

function ShoppingBagDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 8 L18 8 L17 21 L7 21 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 8 C 9 4.5, 15 4.5, 15 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PriceTagDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3 11 L11 3 L20 3 L20 12 L12 20 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="15.5" cy="7.5" r="1.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function GiftBoxDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3.5" y="9" width="17" height="12" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 13.5 L20.5 13.5 M12 9 L12 21" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 9 C 8 9, 8 4, 12 5 C 16 4, 16 9, 12 9 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CoffeeCupDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M6 9 L18 9 L17 20 C17 20.5 16.5 21 16 21 L8 21 C7.5 21 7 20.5 7 20 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M6 9 L18 9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9 4 C 9 6, 10.5 6, 10.5 8 M13.5 4 C 13.5 6, 15 6, 15 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatBubbleDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M3 5.5 C 3 4, 4 3, 5.5 3 L18.5 3 C 20 3, 21 4, 21 5.5 L21 13.5 C 21 15, 20 16, 18.5 16 L9 16 L5 20 L5.5 16 C 4 16, 3 15, 3 13.5 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LipstickDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9 21 L15 21 L14 13 L10 13 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M10 13 L9.5 8 C 9.5 8 10.5 5 12 3 C 13.5 5 14.5 8 14.5 8 L14 13 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HighHeelDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M3 19 C 3 17, 5 16.5, 7 16.5 L9 16.5 C 9 14, 11 11.5, 14.5 10.5 C 17 9.8, 19 8, 19.5 5.5 C 20.5 6, 21 8, 20 10 C 19 12, 17.5 13, 17.5 15 C 17.5 17, 19 17.5, 19 19 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrownDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M3 18 L4.5 8 L9 12.5 L12 6 L15 12.5 L19.5 8 L21 18 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M3 18 L21 18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CameraDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="2.5" y="7" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7 L9.5 4.5 L14.5 4.5 L16 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function LocationPinDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 21 C 12 21, 5 13.5, 5 8.5 C 5 4.9, 8.1 2 12 2 C 15.9 2, 19 4.9, 19 8.5 C 19 13.5, 12 21, 12 21 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="8.5" r="2.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CloudDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M6.5 17 C 3.5 17, 2 15, 2 12.8 C 2 10.6, 3.8 9.2, 5.8 9.4 C 6.2 6.8, 8.6 5, 11.2 5.6 C 13 6, 14.2 7.4, 14.6 9 C 17.2 8.6, 19.5 10.6, 19.5 13 C 19.5 15.4, 17.5 17, 15.5 17 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoonDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M15.5 3 C 10 3.5, 6 8, 6 13 C 6 18.5, 10.5 21.5, 15 20.8 C 10.8 18.5, 9 14.2 10 10 C 10.8 6.8, 13 4.3, 15.5 3 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BowDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M11 12 C 8 9, 3 8, 2.5 11 C 2 14, 7 14, 11 12 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M13 12 C 16 9, 21 8, 21.5 11 C 22 14, 17 14, 13 12 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EnvelopeDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 6 L12 13 L21 6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function LightningDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M13 2 L5 14 L11 14 L10 22 L19 9 L13 9 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function DiamondDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M7 4 L17 4 L21 9 L12 21 L3 9 Z M3 9 L21 9 M7 4 L9 9 L12 21 L15 9 L17 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunglassesDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="6.5" cy="13" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="13" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 12 C 11.5 10.5, 12.5 10.5, 13.5 12" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 12 L4.5 10.5 M21.5 12 L19.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MusicNoteDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9 18 L9 5 L20 3 L20 15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="2.7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="15" r="2.7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ScribbleArrowDoodle(props: IconProps) {
  return (
    <svg viewBox="0 0 60 60" fill="none" {...props}>
      <path
        d="M6 50 C 10 34, 22 30, 30 32 C 40 34, 40 20, 34 12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M27 16 L34 12 L36 20"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS: Array<(props: IconProps) => JSX.Element> = [
  HeartDoodle,
  StarDoodle,
  SparkleDoodle,
  ShoppingBagDoodle,
  PriceTagDoodle,
  GiftBoxDoodle,
  CoffeeCupDoodle,
  ChatBubbleDoodle,
  LipstickDoodle,
  HighHeelDoodle,
  CrownDoodle,
  CameraDoodle,
  LocationPinDoodle,
  CloudDoodle,
  MoonDoodle,
  BowDoodle,
  EnvelopeDoodle,
  LightningDoodle,
  DiamondDoodle,
  SunglassesDoodle,
  MusicNoteDoodle,
];

const SIZES = ['h-4 w-4', 'h-5 w-5', 'h-6 w-6', 'h-7 w-7'];

// Kept faint (8-14% opacity, occasional gold) so ~80 icons scattered right
// through the logo/text/button zone still reads as texture, not clutter —
// the elements in front stay legible since nothing here approaches their contrast.
const COLOR_CLASSES = [
  'text-black/[0.08] dark:text-white/[0.10]',
  'text-black/[0.12] dark:text-white/[0.14]',
  'text-[#f5c518]/50',
];

const GRID_COLS = 9;
const GRID_ROWS = 9;
const DOODLE_SEED = 20260907;

interface GeneratedDoodle {
  Icon: (props: IconProps) => JSX.Element;
  left: number;
  top: number;
  size: string;
  rotate: number;
  colorClass: string;
}

/** Deterministic PRNG (mulberry32) so the scatter is stable across renders instead of reshuffling every time. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ExclusionZone {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

// The doodle grid paints behind everything (z-0 vs. z-10), so this isn't about
// z-order — it's about a doodle's own bounding box poking out past a small
// button's actual footprint and reading as visual clutter right next to it.
// These zones keep grid cells from landing where that's most noticeable: the
// two corner nav buttons and the bottom swipe-up card.
const EXCLUSION_ZONES: ExclusionZone[] = [
  { xMin: 0, xMax: 18, yMin: 0, yMax: 11 }, // Mzigo Ego corner button
  { xMin: 74, xMax: 100, yMin: 0, yMax: 11 }, // Creator corner button
  { xMin: 0, xMax: 100, yMin: 92, yMax: 100 }, // bottom swipe-up card
];

function isExcluded(left: number, top: number): boolean {
  return EXCLUSION_ZONES.some(
    (zone) => left >= zone.xMin && left <= zone.xMax && top >= zone.yMin && top <= zone.yMax
  );
}

/**
 * A jittered grid scatter: the page is divided into GRID_COLS x GRID_ROWS
 * cells and one icon is placed near the center of each (with random offset,
 * size, rotation, and color) — giving even coverage across the whole page,
 * including the logo/text/button zone, rather than clustering in corners.
 * Cells landing in EXCLUSION_ZONES are skipped outright.
 */
function buildDoodleGrid(): GeneratedDoodle[] {
  const rand = mulberry32(DOODLE_SEED);
  const cellWidth = 100 / GRID_COLS;
  const cellHeight = 100 / GRID_ROWS;
  const doodles: GeneratedDoodle[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const jitterX = (rand() - 0.5) * cellWidth * 0.7;
      const jitterY = (rand() - 0.5) * cellHeight * 0.7;
      const left = col * cellWidth + cellWidth / 2 + jitterX;
      const top = row * cellHeight + cellHeight / 2 + jitterY;

      // Still consume the same number of rand() calls per cell whether kept or
      // skipped, so excluding a cell never shifts every subsequent icon/size/
      // rotation choice and silently changes the whole layout.
      const iconIndex = Math.floor(rand() * ICONS.length);
      const sizeIndex = Math.floor(rand() * SIZES.length);
      const rotate = Math.round((rand() - 0.5) * 40);
      const colorIndex = Math.floor(rand() * COLOR_CLASSES.length);

      if (isExcluded(left, top)) continue;

      doodles.push({
        Icon: ICONS[iconIndex],
        left,
        top,
        size: SIZES[sizeIndex],
        rotate,
        colorClass: COLOR_CLASSES[colorIndex],
      });
    }
  }
  return doodles;
}

const DOODLE_GRID = buildDoodleGrid();

/**
 * Purely decorative background doodles for the landing screen — hand-drawn
 * style icons (hearts, tags, bags, a crown, a coffee cup...) scattered evenly
 * across the *entire* page via a jittered grid, including behind the logo,
 * CTA text, and Play Store button, so nothing reads as blank. Non-interactive
 * and hidden from assistive tech since they carry no meaning; kept faint
 * enough that the real content in front stays fully legible.
 */
export function LandingDoodles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {DOODLE_GRID.map(({ Icon, left, top, size, rotate, colorClass }, index) => (
        <div
          key={index}
          className={`absolute ${size} ${colorClass}`}
          style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
        >
          <Icon className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}
