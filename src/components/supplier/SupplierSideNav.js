import React from 'react';

const D = { navy: '#031632', gold: '#775a19', goldLight: '#fed488', error: '#ba1a1a' };

function SupplierSideNav({ activeTab, setActiveTab, pendingCount, onLogout, onAddProduct, isTablet, userProfile }) {
  const navWidth = isTablet ? 200 : 240;
  const tabs = [
    { id: 'home', label: 'Dashboard', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { id: 'products', label: 'Inventory', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'orders', label: 'Orders', badge: pendingCount, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { id: 'profile', label: 'Profile', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  ];
  return (
    <div style={{ width: navWidth, flexShrink: 0, backgroundColor: D.navy, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, boxShadow: '2px 0 12px rgba(3,22,50,0.15)' }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
        <span style={{ fontSize: 10, color: D.goldLight, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Jain Agency</span>
        <span style={{ fontSize: isTablet ? 14 : 16, fontWeight: 800, color: 'white', display: 'block' }}>Supplier Panel</span>
        {userProfile?.firmName && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'block', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile.firmName}</span>}
      </div>
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isTablet ? '10px 12px' : '11px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: isActive ? 'white' : 'rgba(255,255,255,0.55)', fontSize: isTablet ? 13 : 14, fontWeight: isActive ? 700 : 500, textAlign: 'left' }}>
              {isActive && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, backgroundColor: D.goldLight, borderRadius: '0 2px 2px 0' }} />}
              {React.cloneElement(tab.icon, { stroke: isActive ? 'white' : 'rgba(255,255,255,0.55)', strokeWidth: isActive ? 2.5 : 1.8 })}
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.badge > 0 && <span style={{ backgroundColor: D.error, color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px' }}>{tab.badge}</span>}
            </button>
          );
        })}
        <button onClick={onAddProduct} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isTablet ? '10px 12px' : '11px 14px', borderRadius: 8, border: `1px solid rgba(119,90,25,0.4)`, cursor: 'pointer', marginTop: 8, backgroundColor: 'rgba(119,90,25,0.15)', color: D.goldLight, fontSize: isTablet ? 13 : 14, fontWeight: 700, textAlign: 'left' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.goldLight} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Product
        </button>
      </nav>
      <div style={{ padding: '12px 8px', borderTop: `1px solid rgba(255,255,255,0.08)` }}>
        <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          Logout
        </button>
      </div>
    </div>
  );
}

export default SupplierSideNav;