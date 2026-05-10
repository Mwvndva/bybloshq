import type { LucideIcon } from 'lucide-react';

type BuyerSection = 'shop' | 'shops' | 'wishlist' | 'orders' | 'profile';

interface BuyerNavItem {
  key: BuyerSection;
  label: string;
  Icon: LucideIcon;
  path: string;
  badge?: boolean;
}

interface BuyerBottomNavProps {
  activeNav: BuyerSection;
  navItems: readonly BuyerNavItem[];
  onSelect: (key: BuyerSection) => void;
}

export function BuyerBottomNav({ activeNav, navItems, onSelect }: BuyerBottomNavProps) {
  return (
    <div style={{
      height: 56,
      background: '#050505',
      borderTop: '0.5px solid rgba(255,255,255,0.16)',
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
    }}>
      {navItems.map(item => (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, background: 'none', border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'opacity 0.15s',
          }}
        >
          <item.Icon
            size={18}
            color={activeNav === item.key ? '#F5C518' : 'rgba(255,255,255,0.68)'}
          />
          <span style={{
            fontSize: 9, fontWeight: 500,
            color: activeNav === item.key ? '#F5C518' : 'rgba(255,255,255,0.68)',
          }}>
            {item.label}
          </span>
          {item.badge && (
            <div style={{
              position: 'absolute', top: 6, right: '50%',
              transform: 'translateX(10px)',
              width: 5, height: 5, borderRadius: '50%',
              background: '#F5C518',
            }} />
          )}
        </button>
      ))}
    </div>
  );
}
