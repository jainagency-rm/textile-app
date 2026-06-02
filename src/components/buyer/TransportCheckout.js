import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const D = {
  navy: '#031632', bg: '#f8f9fa', surface: '#ffffff',
  textPrimary: '#191c1d', textSecondary: '#44474d',
  border: '#c5c6ce', borderLight: '#e7e8e9',
  error: '#ba1a1a', success: '#1a6b3c', gold: '#775a19'
};

function TransportCheckout({ suppliers, savedTransporters = [], onConfirm, onCancel, userCity = '' }) {
  // selections: { supplierId: { transporter, deliveryAddress } }
  const [selections, setSelections] = useState({});
  const [addingFor, setAddingFor] = useState(null);
  const [newTransport, setNewTransport] = useState({ name: '', gst: '', phone: '' });
  const [nameError, setNameError] = useState('');
  const [gstError, setGstError] = useState('');
  const [firestoreTransporters, setFirestoreTransporters] = useState([]);

  useEffect(() => {
    getDocs(collection(db, 'transporters'))
      .then(snap => setFirestoreTransporters(
        snap.docs.map(d => d.data().name).sort((a, b) => a.localeCompare(b))
      ))
      .catch(console.error);
  }, []);

  // Delivery address state per supplier
  const [deliveryAddresses, setDeliveryAddresses] = useState(() => {
    // ✅ Pre-fill all suppliers with userCity so buyer doesn't need to touch the field
    const init = {};
    suppliers.forEach(s => { init[s.id] = userCity || ''; });
    return init;
  });

  const setDeliveryAddress = (sId, val) =>
    setDeliveryAddresses(prev => ({ ...prev, [sId]: val }));

  const handleSelectPreset = (sId, name) => {
    if (name === 'OTHER') { setAddingFor(sId); return; }
    if (!name) return;
    setSelections(prev => ({
      ...prev,
      [sId]: { ...prev[sId], transporter: { name, id: `preset_${name}` } }
    }));
  };

  // ✅ Validate name (caps + spaces only) and GST format
  const validateName = (val) => {
    const upper = val.toUpperCase();
    if (upper && !/^[A-Z0-9& .-]+$/.test(upper)) {
      setNameError('Only capital letters, numbers & spaces allowed');
    } else { setNameError(''); }
    setNewTransport(prev => ({ ...prev, name: upper }));
  };

  const validateGst = (val) => {
    const upper = val.toUpperCase();
    if (upper && !/^[A-Z0-9]*$/.test(upper)) {
      setGstError('GST: capital letters and numbers only');
    } else { setGstError(''); }
    setNewTransport(prev => ({ ...prev, gst: upper }));
  };

  const handleSaveNew = (sId) => {
    if (!newTransport.name.trim()) return alert('Transport Name required');
    if (nameError || gstError) return;
    const transportObj = {
      name: newTransport.name.trim(),
      gst: newTransport.gst.trim(),
      phone: newTransport.phone.trim() ? `+91 ${newTransport.phone.trim()}` : '',
      id: Date.now().toString(),
    };
    setSelections(prev => ({
      ...prev,
      [sId]: { ...prev[sId], transporter: transportObj }
    }));
    setAddingFor(null);
    setNewTransport({ name: '', gst: '', phone: '' });
    setNameError(''); setGstError('');
  };

  const handleConfirm = () => {
    for (const sup of suppliers) {
      if (!selections[sup.id]?.transporter)
        return alert(`"${sup.firmName}" ke liye transporter select karo`);
      if (!deliveryAddresses[sup.id]?.trim())
        return alert(`"${sup.firmName}" ke liye delivery address daalo`);
    }
    // Merge transport + delivery address per supplier
    const result = {};
    for (const sup of suppliers) {
      result[sup.id] = {
        ...selections[sup.id].transporter,
        deliveryAddress: deliveryAddresses[sup.id].trim(),
      };
    }
    onConfirm(result);
  };

  const allDone = suppliers.every(s =>
    selections[s.id]?.transporter && deliveryAddresses[s.id]?.trim()
  );

  const S = {
    overlay: {
      position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(3,22,50,0.6)', zIndex: 300,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
    },
    sheet: {
      backgroundColor: D.surface, borderRadius: '20px 20px 0 0',
      width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto',
      padding: '0 0 32px',
    },
    header: {
      position: 'sticky', top: 0, backgroundColor: D.surface,
      padding: '14px 20px 12px', borderBottom: `1px solid ${D.borderLight}`, zIndex: 1,
    },
    handle: { width: 40, height: 5, backgroundColor: D.borderLight, borderRadius: 3, margin: '0 auto 12px' },
    supplierBlock: { padding: '16px 20px', borderBottom: `1px solid ${D.borderLight}` },
    dispatchBadge: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, color: D.gold, fontWeight: 600,
      backgroundColor: '#fef7e0', padding: '4px 10px', borderRadius: 20, marginBottom: 12,
    },
    sectionLabel: { fontSize: 12, fontWeight: 700, color: D.navy, marginBottom: 6, display: 'block' },
    tCard: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 10, marginBottom: 6,
      border: `1.5px solid ${D.borderLight}`,
      backgroundColor: D.bg, cursor: 'pointer',
    },
    tCardSelected: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 10, marginBottom: 6,
      border: `2px solid ${D.navy}`, backgroundColor: '#eef2f9', cursor: 'pointer',
    },
    radioOuter: {
      width: 18, height: 18, borderRadius: '50%',
      border: `2px solid ${D.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    radioSelected: {
      width: 18, height: 18, borderRadius: '50%',
      border: `2px solid ${D.navy}`, backgroundColor: D.navy,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    radioDot: { width: 7, height: 7, borderRadius: '50%', backgroundColor: 'white' },
    select: {
      width: '100%', padding: '10px 12px',
      border: `1.5px solid ${D.border}`, borderRadius: 8,
      fontSize: 14, color: D.textPrimary, backgroundColor: D.surface,
      outline: 'none', marginBottom: 8,
    },
    input: {
      width: '100%', padding: '10px 12px',
      border: `1.5px solid ${D.border}`, borderRadius: 8,
      fontSize: 14, marginBottom: 8, boxSizing: 'border-box',
      outline: 'none', backgroundColor: D.surface, color: D.textPrimary,
    },
    phoneRow: {
      display: 'flex', alignItems: 'center',
      border: `1.5px solid ${D.border}`, borderRadius: 8,
      overflow: 'hidden', marginBottom: 8,
    },
    phonePrefix: {
      padding: '10px 10px', backgroundColor: D.bg,
      fontSize: 13, fontWeight: 700, color: D.navy,
      borderRight: `1px solid ${D.border}`, flexShrink: 0,
    },
    phoneInput: {
      flex: 1, padding: '10px 12px', border: 'none',
      fontSize: 14, outline: 'none', backgroundColor: 'transparent',
    },
    textarea: {
      width: '100%', padding: '10px 12px',
      border: `1.5px solid ${D.border}`, borderRadius: 8,
      fontSize: 13, resize: 'vertical', outline: 'none',
      boxSizing: 'border-box', fontFamily: 'inherit',
      minHeight: 60, marginBottom: 4,
    },
    addNewBtn: {
      width: '100%', padding: '9px 12px',
      border: `1.5px dashed ${D.border}`, borderRadius: 8,
      backgroundColor: 'transparent', color: D.navy,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
    },
    newFormWrap: {
      backgroundColor: D.bg, borderRadius: 10,
      padding: '12px', border: `1.5px solid ${D.borderLight}`, marginTop: 8,
    },
    formActions: { display: 'flex', gap: 8, marginTop: 4 },
    btnPrimary: {
      flex: 1, padding: '11px', backgroundColor: D.navy, color: 'white',
      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    },
    btnGhost: {
      flex: 1, padding: '11px', backgroundColor: 'transparent', color: D.navy,
      border: `1.5px solid ${D.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    confirmBtn: {
      display: 'block', width: 'calc(100% - 40px)', margin: '20px 20px 0',
      padding: '15px', backgroundColor: D.navy, color: 'white',
      border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
    },
    confirmBtnDisabled: {
      display: 'block', width: 'calc(100% - 40px)', margin: '20px 20px 0',
      padding: '15px', backgroundColor: D.border, color: 'white',
      border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'not-allowed',
    },
    checkRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' },
    checkbox: (checked) => ({
      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
      border: `2px solid ${checked ? D.navy : D.border}`,
      backgroundColor: checked ? D.navy : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }),
    errorText: { fontSize: 11, color: D.error, marginTop: -6, marginBottom: 6, display: 'block' },
    selectedBadge: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, color: D.success,
      backgroundColor: '#e6f4ea', padding: '3px 8px', borderRadius: 20,
    },
  };

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.handle} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: D.navy }}>Transport Details</h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: D.textSecondary }}>
                Select transporter and delivery address for each supplier
              </p>
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: D.textSecondary, padding: '0 0 0 12px', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {suppliers.map(sup => {
          const sel = selections[sup.id];
          const isAdding = addingFor === sup.id;
          const selectedTransporter = sel?.transporter;

          return (
            <div key={sup.id} style={S.supplierBlock}>
              {/* Supplier name */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: D.navy }}>{sup.firmName}</span>
              </div>

              {/* Selected transporter card */}
              {selectedTransporter && !isAdding && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `2px solid ${D.navy}`, backgroundColor: '#eef2f9', marginBottom: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: D.navy }}>{selectedTransporter.name}</p>
                    {(selectedTransporter.phone || selectedTransporter.gst) && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: D.textSecondary }}>
                        {[selectedTransporter.gst, selectedTransporter.phone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    style={{ fontSize: 11, color: D.navy, backgroundColor: 'transparent', border: `1px solid ${D.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setSelections(prev => ({ ...prev, [sup.id]: { ...prev[sup.id], transporter: null } }))}
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Dispatch city badge — from product */}
              {sup.dispatchCity && (
                <div style={S.dispatchBadge}>
                  📍 Dispatching from: {sup.dispatchCity}
                </div>
              )}

              {/* ── TRANSPORTER SELECTION ── */}
              <span style={S.sectionLabel}>Select Transporter</span>

              {/* Preset dropdown */}
              {!isAdding && (
                <>
                  <select
                    style={S.select}
                    value={selectedTransporter?.id?.startsWith('preset_') ? selectedTransporter.name : ''}
                    onChange={e => handleSelectPreset(sup.id, e.target.value)}
                  >
                    <option value="">— Select from list —</option>
                    {firestoreTransporters.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  <button style={S.addNewBtn} onClick={() => setAddingFor(sup.id)}>
                    <span style={{ fontSize: 16 }}>+</span> Add New Transport
                  </button>
                </>
              )}

              {/* Add new transport form */}
              {isAdding && (
                <div style={S.newFormWrap}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: D.navy }}>Add New Transporter</p>

                  <input
                    style={S.input}
                    placeholder="TRANSPORT NAME *  (e.g. VRL LOGISTICS)"
                    value={newTransport.name}
                    onChange={e => validateName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNew(sup.id); }}
                  />
                  {nameError && <span style={S.errorText}>{nameError}</span>}

                  <input
                    style={S.input}
                    placeholder="GST NUMBER  (Optional, e.g. 27AAACV1234A1Z5)"
                    value={newTransport.gst}
                    onChange={e => validateGst(e.target.value)}
                    maxLength={15}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNew(sup.id); }}
                  />
                  {gstError && <span style={S.errorText}>{gstError}</span>}

                  <div style={S.phoneRow}>
                    <span style={S.phonePrefix}>+91</span>
                    <input
                      style={S.phoneInput}
                      placeholder="Contact No  (Optional)"
                      type="tel"
                      maxLength={10}
                      value={newTransport.phone}
                      onChange={e => setNewTransport(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveNew(sup.id); }}
                    />
                  </div>

                  <div style={S.formActions}>
                    <button style={S.btnGhost} onClick={() => { setAddingFor(null); setNewTransport({ name: '', gst: '', phone: '' }); setNameError(''); setGstError(''); }}>Cancel</button>
                    <button style={S.btnPrimary} onClick={() => handleSaveNew(sup.id)}>Select This</button>
                  </div>
                </div>
              )}

              {/* ── DELIVERY CITY ── */}
              <div style={{ marginTop: 14 }}>
                <span style={S.sectionLabel}>
                  Delivery City <span style={{ color: D.error }}>*</span>
                </span>
                <input
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: `1.5px solid ${D.border}`, borderRadius: 8,
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    backgroundColor: D.surface, color: D.textPrimary,
                  }}
                  placeholder="e.g. Mumbai"
                  value={deliveryAddresses[sup.id] || ''}
                  onChange={e => setDeliveryAddress(sup.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && allDone) { e.preventDefault(); handleConfirm(); } }}
                />
              </div>
            </div>
          );
        })}

        {/* Confirm button */}
        <button
          style={allDone ? S.confirmBtn : S.confirmBtnDisabled}
          onClick={handleConfirm}
          disabled={!allDone}
        >
          {allDone
            ? 'Confirm & Place Order'
            : `${suppliers.filter(s => !selections[s.id]?.transporter || !deliveryAddresses[s.id]?.trim()).length} supplier(s) pending`}
        </button>
      </div>
    </div>
  );
}

export default TransportCheckout;