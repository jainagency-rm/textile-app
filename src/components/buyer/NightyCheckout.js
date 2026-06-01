import React, { useState, useEffect } from 'react';

const D = { navy: '#031632', textSecondary: '#44474d', surface: '#ffffff', border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c', gold: '#775a19' };

function NightyCheckout({ nightyBySupplier, onConfirm, onCancel }) {
  const [packingTypes, setPackingTypes] = useState({});
  const suppliers = Object.keys(nightyBySupplier);

  const getPackingInfo = (totalSets, packType) => {
    const typeNum = Number(packType);
    const fullBales = Math.floor(totalSets / typeNum);
    const looseSets = totalSets % typeNum;
    const setsToRemove = looseSets;
    const setsToAdd = looseSets > 0 ? typeNum - looseSets : 0;
    return { typeNum, fullBales, looseSets, setsToRemove, setsToAdd };
  };

  const allClean = suppliers.every(sId => {
    const group = nightyBySupplier[sId];
    const totalSets = group.items.reduce((sum, i) => sum + (i.sets || 0), 0);
    const cur = packingTypes[sId] || '8';
    const { looseSets } = getPackingInfo(totalSets, cur);
    return looseSets === 0;
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && allClean) handleConfirm();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel, packingTypes, allClean]);

  const handleConfirm = () => {
    let tempPackingDetails = {};
    for (const sId of suppliers) {
      const group = nightyBySupplier[sId];
      const totalSets = group.items.reduce((sum, item) => sum + (item.sets || 0), 0);
      const pType = packingTypes[sId] || '8';
      const { typeNum, fullBales, looseSets } = getPackingInfo(totalSets, pType);
      tempPackingDetails[sId] = {
        packingType: typeNum,
        totalBales: fullBales,
        looseSets,
        totalSets,
        totalPcs: totalSets * (group.items[0]?.pcsPerSet || 30)
      };
    }
    onConfirm(tempPackingDetails);
  };

  const S = {
    overlay: { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { backgroundColor: D.surface, borderRadius: '16px', padding: '16px 20px 32px', width: '90%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' },
    handle: { width: 40, height: 5, backgroundColor: D.border, borderRadius: 3, margin: '0 auto 16px' },
    btnPrimary: (disabled) => ({ display: 'block', width: '100%', padding: '14px', backgroundColor: disabled ? D.border : D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 10 }),
    btnGhost: { display: 'block', width: '100%', padding: '12px', backgroundColor: 'transparent', color: D.textSecondary, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
    packActive: { flex: 1, padding: '14px 10px', backgroundColor: D.navy, color: 'white', border: `2px solid ${D.navy}`, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
    packBtn: { flex: 1, padding: '14px 10px', backgroundColor: D.surface, color: D.navy, border: `2px solid ${D.borderLight}`, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
    adjustBtn: { padding: '8px 14px', border: `1.5px solid ${D.border}`, borderRadius: 8, backgroundColor: D.surface, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: D.navy },
  };

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.handle} />
        <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: D.navy }}>Select Bale Packing</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: D.textSecondary }}>Sets must be in complete bales — no loose sets allowed.</p>

        {suppliers.map(sId => {
          const group = nightyBySupplier[sId];
          const totalSets = group.items.reduce((sum, i) => sum + (i.sets || 0), 0);
          const cur = packingTypes[sId] || '8';
          const { typeNum, fullBales, looseSets, setsToRemove, setsToAdd } = getPackingInfo(totalSets, cur);
          const isClean = looseSets === 0;

          return (
            <div key={sId} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${D.borderLight}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontWeight: 700, color: D.navy, margin: 0 }}>{group.supplierFirm}</p>
                <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, backgroundColor: '#f0f4ff', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>{totalSets} Sets</p>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                {['8', '10'].map(t => (
                  <button key={t} onClick={() => setPackingTypes({ ...packingTypes, [sId]: t })} style={cur === t ? S.packActive : S.packBtn}>
                    <span style={{ fontSize: 22, fontWeight: 800 }}>{t}</span>
                    <span style={{ fontSize: 12, opacity: cur === t ? 0.9 : 0.7 }}>Sets / Bale</span>
                  </button>
                ))}
              </div>

              {/* Packing Preview */}
              <div style={{ padding: '10px 12px', backgroundColor: isClean ? '#e6f4ea' : '#fce8e6', borderRadius: 8, marginBottom: isClean ? 0 : 12 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isClean ? D.success : D.error }}>
                  {isClean
                    ? `✓ ${fullBales} Bale${fullBales !== 1 ? 's' : ''} × ${typeNum} sets = ${totalSets} sets (Perfect)`
                    : `${fullBales} Bale${fullBales !== 1 ? 's' : ''} × ${typeNum} sets + ${looseSets} Loose Set${looseSets !== 1 ? 's' : ''}`
                  }
                </p>
              </div>

              {/* Adjust buttons — only when loose sets exist */}
              {!isClean && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: D.textSecondary, fontWeight: 500 }}>Fix:</span>
                  <button style={S.adjustBtn} onClick={() => { onCancel(); }}>
                    − Remove {setsToRemove} set{setsToRemove !== 1 ? 's' : ''}
                  </button>
                  <span style={{ fontSize: 12, color: D.textSecondary }}>or</span>
                  <button style={S.adjustBtn} onClick={() => { onCancel(); }}>
                    + Add {setsToAdd} set{setsToAdd !== 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button style={S.btnPrimary(!allClean)} onClick={allClean ? handleConfirm : undefined} disabled={!allClean}>
          {allClean ? 'Next: Select Transport →' : 'Fix loose sets to continue'}
        </button>
        <button style={S.btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default NightyCheckout;
