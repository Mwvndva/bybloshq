export function BuyerShopCardSkeleton() {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e7e2d6', borderRadius: 16, padding: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(17,17,17,0.06)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f3f1ea' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 12, width: '62%', borderRadius: 999, background: '#f3f1ea', marginBottom: 8 }} />
          <div style={{ height: 10, width: '86%', borderRadius: 999, background: '#f3f1ea', marginBottom: 6 }} />
          <div style={{ height: 10, width: '54%', borderRadius: 999, background: '#f3f1ea' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
        {[0, 1, 2].map(item => (
          <div key={item} style={{ height: 46, borderRadius: 12, background: '#f3f1ea' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 12 }}>
        <div style={{ height: 40, borderRadius: 12, background: '#f3f1ea' }} />
        <div style={{ width: 94, height: 40, borderRadius: 12, background: '#fff7d6' }} />
      </div>
    </div>
  );
}
