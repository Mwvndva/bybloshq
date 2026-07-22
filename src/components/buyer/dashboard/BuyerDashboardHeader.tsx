import { NotificationBell } from '@/features/notifications/NotificationBell';
import { AccountSwitcher } from '@/features/auth/components/AccountSwitcher';

export function BuyerDashboardHeader() {
  return (
    <div style={{
      padding: '16px 18px 14px',
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ justifySelf: 'start' }}>
        <NotificationBell />
      </div>
      <span style={{ justifySelf: 'center', fontSize: 15, fontWeight: 700, color: 'var(--byblos-text, #ffffff)', letterSpacing: '-0.2px' }}>
        Trusted Businesses
      </span>
      <div style={{ justifySelf: 'end' }}>
        <AccountSwitcher />
      </div>
    </div>
  );
}
