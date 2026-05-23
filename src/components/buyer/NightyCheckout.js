import React, { useState, useEffect } from 'react';

const D = { navy: '#031632', textSecondary: '#44474d', surface: '#ffffff', border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c' };

function NightyCheckout({ nightyBySupplier, onConfirm, onCancel }) {
  const [packingTypes, setPackingTypes] = useState({});
  const [error, setError] = useState('');
  const suppliers = Object.keys(nightyBySupplier);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleConfirm = () => {
    let tempPackingDetails = {}; let hasError = false;
    for (const sId of suppliers) {
      const group = nightyBySupplier[sId];
      const totalSets = group.items.reduce((sum, item) => sum + (item.sets || 0), 0);
      const pType = packingTypes[sId];
      if (!pType) { setError(`Select packing for ${group.supplierFirm}`); hasError = true; break; }
      const typeNum = Number(pType);
      if (totalSets % typeNum !== 0) { setError(`${group.supplierFirm}: ${totalSets} sets not divisible by ${pType}`); hasError = true; break; }
      tempPackingDetails[sId] = { packingType: typeNum, totalBales: totalSets / typeNum, totalSets, totalPcs: totalSets * (group.items[0]?.pcsPerSet || 30) };
    }
    if (!hasError) onConfirm(tempPackingDetails);
  };

  const S = {
    overlay: { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { backgroundColor: D.surface, borderRadius: '16px', padding: '12px 16px 32px', width: '90%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    handle: { width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '8px auto 12px' },
    btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
    btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    packActive: { flex: 1, padding: '14px 10px', backgroundColor: D.navy, color: 'white', border: `2px solid ${D.navy}`, borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
    packBtn: { flex: 1, padding: '14px 10px', backgroundColor: D.surface, color: D.navy, border: `2px solid ${D.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  };

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.handle} />
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: D.navy }}>Bale Packing Selection</h3>
        {suppliers.map(sId => {
          const group = nightyBySupplier[sId];
          const totalSets = group.items.reduce((sum, i) => sum + (i.sets || 0), 0);
          const cur = packingTypes[sId];
          const isValid = cur ? totalSets % Number(cur) === 0 : false;
          return (
            <div key={sId} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${D.borderLight}` }}>
              <p style={{ fontWeight: 700, color: D.navy, margin: '0 0 4px' }}>{group.supplierFirm}</p>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: D.textSecondary }}>Total: <b>{totalSets} sets</b></p>
              <div style={{ display: 'flex', gap: 10 }}>
                {['8', '10'].map(t => (
                  <button key={t} onClick={() => { setPackingTypes({ ...packingTypes, [sId]: t }); setError(''); }} style={cur === t ? S.packActive : S.packBtn}>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>{t}</span>
                    <span style={{ fontSize: 11 }}>Sets/Bale</span>
                  </button>
                ))}
              </div>
              {cur && <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: isValid ? D.success : D.error }}>
                {isValid ? `✓ ${totalSets / Number(cur)} complete bale(s)` : `✗ Need multiple of ${cur}`}
              </p>}
            </div>
          );
        })}
        {error && <p style={{ color: D.error, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button style={S.btnPrimary} onClick={handleConfirm}>Confirm & Place Order</button>
        <button style={{ ...S.btnGhost, marginTop: 10 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
export default NightyCheckout;