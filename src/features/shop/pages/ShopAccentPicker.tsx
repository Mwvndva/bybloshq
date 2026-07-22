import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { Palette } from 'lucide-react';
import type { Theme } from '@/hooks/useShopTheme';

const ACCENT_OPTIONS: { name: string; value: Theme; color: string }[] = [
  { name: 'Default', value: 'default', color: '#f59e0b' },
  { name: 'Black',   value: 'black',   color: '#020617' },
  { name: 'Pink',    value: 'pink',    color: '#ec4899' },
  { name: 'Brown',   value: 'brown',   color: '#92400e' },
  { name: 'Orange',  value: 'orange',  color: '#f97316' },
  { name: 'Green',   value: 'green',   color: '#10b981' },
  { name: 'Red',     value: 'red',     color: '#ef4444' },
  { name: 'Yellow',  value: 'yellow',  color: '#facc15' },
];

interface ShopAccentPickerProps {
  selectedAccent: Theme;
  onAccentChange: (accent: Theme) => void;
}

export function ShopAccentPicker({ selectedAccent, onAccentChange }: ShopAccentPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = ACCENT_OPTIONS.find((o) => o.value === selectedAccent) ?? ACCENT_OPTIONS[0];

  return (
    <div className="shop-accent-picker" ref={ref}>
      <button
        type="button"
        className="shop-accent-picker__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change shop accent colour"
        title="Accent colour"
      >
        {/* Colour dot */}
        <span
          style={{ background: current.color, width: '0.7rem', height: '0.7rem', borderRadius: '50%', display: 'inline-block', border: '1.5px solid rgba(255,255,255,0.35)', flexShrink: 0 }}
        />
        <Palette className="h-3 w-3 opacity-80" />
        <span className="hidden sm:inline">Accent</span>
      </button>

      {open && (
        <div className="shop-accent-picker__panel" role="dialog" aria-label="Select accent colour">
          <p className="shop-accent-picker__label">Shop Accent</p>
          <div className="shop-accent-picker__swatches">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`shop-accent-picker__swatch${selectedAccent === opt.value ? ' shop-accent-picker__swatch--active' : ''}`}
                style={{ '--theme-swatch-color': opt.color, background: opt.color } as CSSProperties}
                title={opt.name}
                onClick={() => {
                  onAccentChange(opt.value);
                  setOpen(false);
                }}
                aria-pressed={selectedAccent === opt.value}
                aria-label={opt.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
