import React, { useState, useEffect } from 'react';

const navy = '#031632';
const bg = '#f8f9fa';
const border = '#e2e8f0';
const textSecondary = '#64748b';
const error = '#ef4444';
const success = '#10b981';

const Field = ({ label, children, half }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: half ? '1 1 140px' : '1 1 100%' }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
    {children}
  </div>
);

export default function AdminDeliveryModal({
  deliveryModal, deliveryStatus, setDeliveryStatus,
  shippingForm, setShippingForm, onSave, onCancel, users, transporters = [], onAddTransporter
}) {
  const [localForm, setLocalForm] = useState(shippingForm);
  const [addingNewTransport, setAddingNewTransport] = useState(false);
  const [newTransportName, setNewTransportName] = useState('');
  const [newTransportError, setNewTransportError] = useState('');

  useEffect(() => {
    setLocalForm(shippingForm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryModal?.id]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  if (!deliveryModal) return null;

  const inputStyle = {
    padding: '10px 12px', border: `1.5px solid ${border}`, borderRadius: 8,
    fontSize: 14, color: navy, outline: 'none', backgroundColor: 'white',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
      <div style={{ backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(3,22,50,0.25)', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${navy} 0%, #1a2b48 100%)`, padding: '20px 24px', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order #{deliveryModal.id?.slice(0, 8).toUpperCase()}</p>
              <h3 style={{ margin: '4px 0 0', color: 'white', fontSize: 18, fontWeight: 800 }}>Update Status</h3>
            </div>
            <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'white', fontWeight: 600 }}>{deliveryModal.buyerFirm}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supplier</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'white', fontWeight: 600 }}>{deliveryModal.supplierFirm}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* Status Select */}
          <Field label="Order Status">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped — Add Dispatch Details</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </Field>
          <p style={{ fontSize: 11, color: textSecondary, margin: '6px 0 0', fontStyle: 'italic' }}>
            "Delivered" and "Partially Dispatched" are set automatically based on quantities.
          </p>

          {/* Dispatch Section */}
          {deliveryStatus === 'Shipped' && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ height: 1, flex: 1, backgroundColor: border }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Dispatch Details</span>
                <div style={{ height: 1, flex: 1, backgroundColor: border }} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Field label="Bill No *" half>
                  <input style={inputStyle} placeholder="e.g. 1234" value={localForm.billNo} onChange={e => setLocalForm({ ...localForm, billNo: e.target.value })} />
                </Field>
                <Field label="Bill Date" half>
                  <input type="date" style={inputStyle} value={localForm.billDate} onChange={e => setLocalForm({ ...localForm, billDate: e.target.value })} />
                </Field>
                <Field label="Transport" half>
                  {!addingNewTransport ? (
                    <div>
                      <input
                        style={inputStyle}
                        placeholder="Type or select transport"
                        value={localForm.transport}
                        list="transport-master-list"
                        onChange={e => setLocalForm({ ...localForm, transport: e.target.value })}
                        onFocus={e => setTimeout(() => e.target.select(), 0)}
                      />
                      <datalist id="transport-master-list">
                        {transporters.map((t) => (
                          <option key={t.id} value={t.name} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        style={{ marginTop: 6, fontSize: 12, color: navy, backgroundColor: 'transparent', border: `1.5px dashed ${border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 600, width: '100%' }}
                        onClick={() => { setAddingNewTransport(true); setNewTransportName(''); setNewTransportError(''); }}
                      >
                        + Add New Transport
                      </button>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, border: `1.5px solid ${border}` }}>
                      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: navy }}>New Transporter Name</p>
                      <input
                        style={inputStyle}
                        placeholder="e.g. VRL LOGISTICS"
                        value={newTransportName}
                        onChange={e => {
                          const upper = e.target.value.toUpperCase();
                          if (upper && !/^[A-Z0-9& .-]+$/.test(upper)) {
                            setNewTransportError('Only capital letters, numbers & spaces allowed');
                          } else { setNewTransportError(''); }
                          setNewTransportName(upper);
                        }}
                        autoFocus
                      />
                      {newTransportError && <p style={{ margin: '0 0 6px', fontSize: 11, color: error }}>{newTransportError}</p>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button
                          type="button"
                          style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${border}`, backgroundColor: 'white', color: textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                          onClick={() => { setAddingNewTransport(false); setNewTransportName(''); setNewTransportError(''); }}
                        >Cancel</button>
                        <button
                          type="button"
                          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', backgroundColor: navy, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => {
                            if (!newTransportName.trim() || newTransportError) return;
                            const name = newTransportName.trim();
                            setLocalForm({ ...localForm, transport: name });
                            if (onAddTransporter) onAddTransporter(name);
                            setAddingNewTransport(false);
                            setNewTransportName('');
                          }}
                        >Add & Select</button>
                      </div>
                    </div>
                  )}
                </Field>
                <Field label="LR No" half>
                  <input style={inputStyle} placeholder="e.g. 9876543" value={localForm.lrNo} onChange={e => setLocalForm({ ...localForm, lrNo: e.target.value })} />
                </Field>
                <Field label="LR Date" half>
                  <input type="date" style={inputStyle} value={localForm.lrDate} onChange={e => setLocalForm({ ...localForm, lrDate: e.target.value })} />
                </Field>
              </div>

              {/* Dispatch Items */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ height: 1, flex: 1, backgroundColor: border }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Quantities</span>
                  <div style={{ height: 1, flex: 1, backgroundColor: border }} />
                </div>
                {localForm.dispatchItems.map((item, idx) => {
                  const remaining = item.orderedQty - item.previouslyDispatched;
                  const isDisabled = remaining <= 0;
                  const unit = item.sets ? 'Set' : (item.moqUnit || item.unit || 'Piece');
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${isDisabled ? border : (item.dispatchingNow > 0 ? '#bbf7d0' : border)}`, backgroundColor: isDisabled ? bg : (item.dispatchingNow > 0 ? '#f0fdf4' : 'white'), marginBottom: 8, opacity: 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: navy }}>{item.productName}{item.size ? ` — ${item.size}` : ''}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: textSecondary }}>
                          Ordered: <b style={{ color: navy }}>{item.orderedQty} {unit}</b>
                          {' · '}Prev: <b style={{ color: success }}>{item.previouslyDispatched}</b>
                          {' · '}Rem: <b style={{ color: isDisabled ? textSecondary : error }}>{remaining}</b>
                        </p>
                        {item.dispatchingNow > remaining && remaining >= 0 && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                            ⚠ {item.dispatchingNow - remaining} extra — over dispatch
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: textSecondary, textTransform: 'uppercase' }}>Now</span>
                        <input
                          type="number" min="0"
                          value={item.dispatchingNow || ''}
                          disabled={isDisabled}
                          style={{ width: 64, padding: '8px 6px', borderRadius: 8, border: `1.5px solid ${item.dispatchingNow > 0 ? success : border}`, backgroundColor: item.dispatchingNow > remaining && remaining >= 0 ? '#fff7ed' : 'white', textAlign: 'center', fontSize: 15, fontWeight: 700, color: navy, outline: 'none' }}
                          onChange={e => {
                            const val = Math.max(0, Number(e.target.value));
                            const updated = [...localForm.dispatchItems];
                            updated[idx] = { ...updated[idx], dispatchingNow: val };
                            setLocalForm({ ...localForm, dispatchItems: updated });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: '13px', borderRadius: 10, border: `1.5px solid ${border}`, backgroundColor: 'white', color: textSecondary, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => { setShippingForm(localForm); onSave(localForm); }} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${navy} 0%, #1a2b48 100%)`, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Save & Update Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
