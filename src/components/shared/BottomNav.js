import React from 'react';

const D = { navy: '#031632', textSecondary: '#44474d', gold: '#775a19', surface: '#ffffff', borderLight: '#e7e8e9' };

function BottomNav({ activeTab, setActiveTab, cartCount }) {
  const tabs = [
    { id: 'browse', label: 'Home', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: 'orders', label: 'Orders', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    { id: 'cart', label: 'Cart', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
    { id: 'profile', label: 'Profile', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, width: '100%', display: 'flex', backgroundColor: D.surface, borderTop: `1px solid ${D.borderLight}`, zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'border-box' }}>
      {tabs.map(tab => (
        <button key={tab.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: 56, color: activeTab === tab.id ? D.navy : D.textSecondary }} onClick={() => setActiveTab(tab.id)}>
          <div style={{ position: 'relative' }}>
            {React.cloneElement(tab.icon, { stroke: activeTab === tab.id ? D.navy : D.textSecondary, strokeWidth: activeTab === tab.id ? 2.5 : 1.8 })}
            {tab.id === 'cart' && cartCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -8, backgroundColor: D.gold, color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 20, padding: '1px 5px', minWidth: 14, textAlign: 'center' }}>{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 700 : 500, marginTop: 2 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
export default BottomNav;