import { ChevronLeft } from 'lucide-react';

interface BuyerDashboardHeaderProps {
  onBack: () => void;
}

export function BuyerDashboardHeader({ onBack }: BuyerDashboardHeaderProps) {
  return (
    <div style={{
      padding: '16px 18px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: '#ffffff', border: '1px solid #e7e2d6', color: '#111111',
        fontSize: 12, cursor: 'pointer', padding: '4px 0',
        borderRadius: 999, paddingInline: 12, height: 32,
      }}>
        <ChevronLeft size={14} /> Back
      </button>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#111111', letterSpacing: '-0.2px' }}>
        Trusted Businesses
      </span>
      <div style={{ width: 30, height: 30 }} />
    </div>
  );
}
