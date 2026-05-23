import React, { useState, useEffect } from 'react';

const D = { navy: '#031632', navyMid: '#1a2b48', gold: '#775a19', bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9', success: '#1a6b3c' };

function getStatusStyle(status) {
  if (status === 'Delivered') return { backgroundColor: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped') return { backgroundColor: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Processing') return { backgroundColor: '#fef7e0', color: '#7a5200' };
  if (status === 'Cancelled') return { backgroundColor: '#fce8e6', color: '#ba1a1a' };
  return { backgroundColor: '#f1f3f4', color: '#44474d' };
}

function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);

  const shipments = order.shipments || [];
  const hasDispatchData = shipments.length > 0;
  const totalItems = order.items?.length || 0;
  const firstItem = order.items?.[0];

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setShowDispatch(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const paymentLabel = () => {
    if (order.paymentStatus === 'Cleared') return { text: '✓ Paid', color: D.success, bg: '#e6f4ea' };
    if (order.paymentStatus === 'Advance Received') return { text: '◑ Part Paid', color: '#7a5200', bg: '#fef7e0' };
    return null;
  };
  const pLabel = paymentLabel();

  const fmtQty = (item) => {
    if (item.sets) return `${item.sets} sets = ${item.pcs} pcs`;
    const unit = (item.unit || 'pc').replace('pieces', 'pcs').replace('piece', 'pc');
    return `${item.quantity} ${unit}`;
  };

  const S = {
    overlay: { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { backgroundColor: D.surface, borderRadius: '16px', padding: '12px 16px 32px', width: '90%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    handle: { width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '8px auto 12px' },
    btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  };

  return (
    <>
      {showDispatch && (
        <div style={S.overlay} onClick={() => setShowDispatch(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.handle} />
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: D.navy }}>Dispatch Details</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${D.borderLight}` }}>
              <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 500 }}>Order ID</span>
              <span style={{ fontSize: 13, color: D.textPrimary, fontWeight: 600 }}>#{order.id.slice(0, 8)}</span>
            </div>

            {shipments.map((ship, idx) => (
              <div key={idx} style={{ marginTop: 14, paddingBottom: 4, borderBottom: idx < shipments.length - 1 ? `2px solid ${D.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 18, backgroundColor: D.gold, borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: D.navy }}>Dispatch {idx + 1}{ship.billDate ? ` · ${ship.billDate}` : ''}</span>
                </div>

                {[['Bill No', ship.billNo], ['Transport', ship.transport], ['LR No', ship.lrNo], ['LR Date', ship.lrDate]].map(([label, val]) => val ? (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                    <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 13, color: D.textPrimary, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                  </div>
                ) : null)}

                {ship.items?.length > 0 && (
                  <div style={{ marginTop: 8, backgroundColor: D.bg, borderRadius: 8, padding: '8px 10px' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: D.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</p>
                    {ship.items.map((item, iIdx) => (
                      <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                        <span style={{ fontSize: 12, color: D.textPrimary }}>{item.productName}{item.size ? ` (${item.size})` : ''}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>{item.qty} {item.unit || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button style={{ ...S.btnGhost, marginTop: 20 }} onClick={() => setShowDispatch(false)}>Close</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: D.surface, borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 6px rgba(3,22,50,0.07)', overflow: 'hidden', border: `1px solid ${D.borderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
          {firstItem?.photoUrl ? (
            <img src={firstItem.photoUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${D.borderLight}` }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: D.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.border} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>#{order.id.slice(0, 8)}</span>
              <span style={{ ...getStatusStyle(order.status), padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{order.status || 'Pending'}</span>
              {pLabel && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, backgroundColor: pLabel.bg, color: pLabel.color }}>{pLabel.text}</span>}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: D.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.supplierFirm} · {totalItems} item{totalItems !== 1 ? 's' : ''}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: D.textSecondary }}>{order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        {expanded && (
          <div style={{ borderTop: `1px solid ${D.borderLight}`, padding: '10px 14px 14px', backgroundColor: '#fafbfc' }}>
            {order.items?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                {item.photoUrl && <img src={item.photoUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{item.productName}</span>
                  {item.designNo && <span style={{ fontSize: 11, color: D.textSecondary }}> · DN{item.designNo}</span>}
                  {item.size && <span style={{ fontSize: 11, color: D.textSecondary }}> · Size {item.size}</span>}
                </div>
                <span style={{ fontSize: 11, color: D.textSecondary, flexShrink: 0, fontWeight: 500 }}>{fmtQty(item)}</span>
              </div>
            ))}
            {order.nightyDetails && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: D.textSecondary }}>
                {order.nightyDetails.totalSets} sets · {order.nightyDetails.packingType} sets/bale · <b style={{ color: D.navy }}>{order.nightyDetails.totalBales} bale(s)</b>
              </p>
            )}
            {hasDispatchData && (
              <button style={{ ...S.btnPrimary, marginTop: 12, padding: '10px', fontSize: 13, backgroundColor: D.navyMid }} onClick={() => setShowDispatch(true)}>📦 View Dispatch Details</button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
export default OrderCard;