import React from 'react';

const D = {
  navy: '#031632', gold: '#775a19', bg: '#f8f9fa', surface: '#ffffff',
  textPrimary: '#191c1d', textSecondary: '#44474d', border: '#c5c6ce',
  success: '#1a6b3c', warning: '#7a5200', error: '#ba1a1a',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function statusBadge(status) {
  const map = {
    Pending:    { bg: '#fff3e0', color: '#7a5200' },
    Processing: { bg: '#e8f0fe', color: '#1a3c6b' },
    Delivered:  { bg: '#e6f4ea', color: '#1a6b3c' },
    Cancelled:  { bg: '#fdecea', color: '#ba1a1a' },
  };
  const s = map[status] || { bg: '#f0f0f0', color: '#44474d' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, backgroundColor: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, emoji }) {
  return (
    <div style={{ backgroundColor: D.surface, borderRadius: 12, padding: 16, position: 'relative', boxShadow: '0 1px 4px rgba(3,22,50,0.07)' }}>
      <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 20 }}>{emoji}</span>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: D.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: D.navy, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function SupplierDashboardHome({ orders, products, userProfile, setActiveTab }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingCount  = orders.filter(o => o.status === 'Pending').length;
  const todayCount    = orders.filter(o => {
    const d = o.createdAt?.toDate?.();
    return d && d >= today;
  }).length;
  const activeProducts = products.filter(p => p.status === 'approved').length;
  const recentOrders = [...orders]
    .sort((a, b) => {
      const aNum = a.orderNumber || 0;
      const bNum = b.orderNumber || 0;
      if (bNum !== aNum) return bNum - aNum;
      return (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0));
    })
    .slice(0, 3);

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: D.textSecondary }}>{greeting()},</p>
        <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: D.navy }}>
          {userProfile?.firmName || 'Supplier'}
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Pending Orders"   value={pendingCount}   emoji="⏳" />
        <StatCard label="Today's Orders"   value={todayCount}     emoji="📦" />
        <StatCard label="Active Products"  value={activeProducts} emoji="🏷️" />
      </div>

      {/* Recent Orders */}
      <div style={{ backgroundColor: D.surface, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(3,22,50,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: D.navy }}>Recent Orders</span>
          <button
            onClick={() => setActiveTab('orders')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: D.navy, fontWeight: 600, padding: 0 }}
          >
            View All →
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: D.textSecondary, fontSize: 13 }}>No orders yet</div>
        ) : (
          recentOrders.map(order => {
            const date = order.createdAt?.toDate?.();
            const dateStr = date
              ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              : '—';
            return (
              <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${D.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, minWidth: 36 }}>
                  #{order.orderNumber || '—'}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: D.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.buyerFirm || 'Unknown Buyer'}
                </span>
                {statusBadge(order.status)}
                <span style={{ fontSize: 11, color: D.textSecondary, flexShrink: 0 }}>{dateStr}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SupplierDashboardHome;
