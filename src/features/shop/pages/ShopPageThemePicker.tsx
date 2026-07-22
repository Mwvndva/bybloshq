import { useCallback, useRef, useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export type ShopPageTheme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'byblos-shop-page-theme';

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveShopTheme(pref: ShopPageTheme): 'light' | 'dark' {
  if (pref === 'system') return getSystemIsDark() ? 'dark' : 'light';
  return pref;
}

const OPTIONS: { value: ShopPageTheme; Icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { value: 'system', Icon: Monitor, label: 'System' },
  { value: 'light',  Icon: Sun,     label: 'Light'  },
  { value: 'dark',   Icon: Moon,    label: 'Dark'   },
];

interface ShopPageThemePickerProps {
  theme: ShopPageTheme;
  onThemeChange: (t: ShopPageTheme) => void;
}

export function ShopPageThemePicker({ theme, onThemeChange }: ShopPageThemePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const resolved = resolveShopTheme(theme);
  const ActiveIcon = OPTIONS.find((o) => o.value === theme)?.Icon ?? Monitor;

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: '0.85rem', right: '0.85rem', zIndex: 60 }}
    >
      {/* Toggle pill */}
      <button
        type="button"
        aria-label="Toggle shop page theme"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.35rem 0.65rem',
          borderRadius: '9999px',
          background: 'rgba(0,0,0,0.42)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '0.68rem',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
          transition: 'background 0.18s',
        }}
      >
        <ActiveIcon className="h-3 w-3" />
        <span style={{ opacity: 0.85 }}>{resolved === 'light' ? 'Light' : 'Dark'}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Shop page theme"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.4rem)',
            right: 0,
            background: 'rgba(8,8,8,0.94)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.11)',
            borderRadius: '0.9rem',
            padding: '0.45rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            minWidth: '7.5rem',
            boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
            animation: 'shop-theme-panel-in 0.14s ease',
          }}
        >
          {OPTIONS.map(({ value, Icon, label }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onThemeChange(value); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.55rem',
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.72rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useShopPageTheme() {
  const [theme, setThemeState] = useState<ShopPageTheme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ShopPageTheme) || 'system';
  });

  const setTheme = useCallback((next: ShopPageTheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const resolved = resolveShopTheme(theme);

  // Listen to OS changes when on "system"
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState('system'); // re-render to recompute
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme, resolved };
}
