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
  const activeLabel = theme === 'system' ? `System (${resolved === 'light' ? 'Light' : 'Dark'})` : (theme === 'light' ? 'Light' : 'Dark');

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: '1.75rem',
        right: '2.5rem',
        zIndex: 60,
      }}
    >
      {/* Toggle pill */}
      <button
        type="button"
        aria-label="Toggle shop page theme"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 0.9rem',
          borderRadius: '9999px',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
          transition: 'all 0.2s ease',
        }}
      >
        <ActiveIcon className="h-4 w-4 shrink-0 text-yellow-400" />
        <span style={{ fontSize: '0.8125rem', letterSpacing: '0.01em' }}>{activeLabel}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Shop page theme"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            background: 'rgba(12, 12, 12, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '1rem',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            minWidth: '9.5rem',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
            animation: 'shop-theme-panel-in 0.15s ease',
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
                  gap: '0.65rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.65rem',
                  border: 'none',
                  background: active ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.8125rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-yellow-400' : ''}`} />
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
