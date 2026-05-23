import React from 'react';

const D = { navy: '#031632', textSecondary: '#44474d', surface: '#ffffff', borderLight: '#e7e8e9', error: '#ba1a1a' };

function SupplierBottomNav({ activeTab, setActiveTab, pendingCount }) {
  const tabs = [
    { id: 'products', label: 'Inventory', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'orders', label: 'Orders', badge: pendingCount, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, width: '100%', display: 'flex', backgroundColor: D.surface, borderTop: `1px solid ${D.borderLight}`, zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: 56, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              {React.cloneElement(tab.icon, { stroke: isActive ? D.navy : D.textSecondary, strokeWidth: isActive ? 2.5 : 1.8 })}
              {tab.badge > 0 && <span style={{ position: 'absolute', top: -6, right: -8, backgroundColor: D.error, color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 20, padding: '1px 5px', minWidth: 14, textAlign: 'center' }}>{tab.badge}</span>}
            </div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, marginTop: 2, color: isActive ? D.navy : D.textSecondary }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SupplierBottomNav;