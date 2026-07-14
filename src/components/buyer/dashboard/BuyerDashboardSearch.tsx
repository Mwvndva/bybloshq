import { Search } from 'lucide-react';

interface BuyerDashboardSearchProps {
  activeSection: 'shop' | 'shops' | 'wishlist' | 'orders' | 'profile';
  productSearchQuery: string;
  shopsSearchQuery: string;
  onProductSearchChange: (value: string) => void;
  onShopsSearchChange: (value: string) => void;
}

export function BuyerDashboardSearch({
  activeSection,
  productSearchQuery,
  shopsSearchQuery,
  onProductSearchChange,
  onShopsSearchChange
}: BuyerDashboardSearchProps) {
  if (activeSection !== 'shop' && activeSection !== 'shops') return null;

  return (
    <div style={{
      padding: '6px 18px 20px',
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14,
        padding: '0 12px', height: 36,
        width: '100%',
        maxWidth: activeSection === 'shop' ? 760 : 560,
        boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
      }}>
        <Search size={14} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0 }} />
        <input
          value={activeSection === 'shop' ? productSearchQuery : shopsSearchQuery}
          onChange={event => activeSection === 'shop' ? onProductSearchChange(event.target.value) : onShopsSearchChange(event.target.value)}
          placeholder={activeSection === 'shop' ? 'Search products...' : 'Search my shops...'}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#ffffff', fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}


