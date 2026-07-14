import { ChevronLeft } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/NotificationBell';

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
        background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.10)', color: '#ffffff',
        fontSize: 12, cursor: 'pointer', padding: '4px 0',
        borderRadius: 999, paddingInline: 12, height: 32,
      }}>
        <ChevronLeft size={14} /> Back
      </button>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
        Trusted Businesses
      </span>
      <NotificationBell />
    </div>
  );
}


