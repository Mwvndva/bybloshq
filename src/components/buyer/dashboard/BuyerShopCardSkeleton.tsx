export function BuyerShopCardSkeleton() {
  return (
    <div style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, padding: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.10)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 12, width: '62%', borderRadius: 999, background: 'rgba(255,255,255,0.14)', marginBottom: 8 }} />
          <div style={{ height: 10, width: '86%', borderRadius: 999, background: 'rgba(255,255,255,0.10)', marginBottom: 6 }} />
          <div style={{ height: 10, width: '54%', borderRadius: 999, background: 'rgba(255,255,255,0.08)' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
        {[0, 1, 2].map(item => (
          <div key={item} style={{ height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 12 }}>
        <div style={{ height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.10)' }} />
        <div style={{ width: 94, height: 40, borderRadius: 12, background: 'rgba(248,113,113,0.08)' }} />
      </div>
    </div>
  );
}
