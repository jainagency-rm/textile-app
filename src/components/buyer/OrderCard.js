import React, { useState, useEffect } from 'react';

const D = { navy: '#031632', navyMid: '#1a2b48', gold: '#775a19', bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9', success: '#1a6b3c' };

function getStatusStyle(status) {
  if (status === 'Delivered') return { backgroundColor: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped' || status === 'Dispatched') return { backgroundColor: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Processing' || status === 'Approved') return { backgroundColor: '#fef7e0', color: '#7a5200' };
  if (status === 'Cancelled') return { backgroundColor: '#fce8e6', color: '#ba1a1a' };
  return { backgroundColor: '#f1f3f4', color: '#44474d' };
}

function OrderCard({ order, onCancel, onReorder }) {
  const [expanded, setExpanded] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);

  const shipments = order.shipments || [];
  const hasDispatchData = shipments.length > 0;
  const totalItems = order.items?.length || 0;

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

  // ✅ FIX: Quantity display
  // Nighty: "2 Sets (60 Pcs)"
  // Set-based non-nighty: "2 Sets (12 Pcs)" — pcsPerSet from order item
  // Piece-based: "2 Pieces"
  const fmtQty = (item) => {
    if (item.sets != null && item.sets > 0) {
      const pcs = item.pcs || (item.sets * (item.pcsPerSet || 30));
      return `${item.sets} Set${item.sets !== 1 ? 's' : ''} (${pcs} Pcs)`;
    }
    const qty = item.quantity || item.orderedQty || 0;
    if (item.moqUnit === 'Set' && item.pcsPerSet) {
      const pcs = qty * item.pcsPerSet;
      return `${qty} Set${qty !== 1 ? 's' : ''} (${pcs} Pcs)`;
    }
    const unit = item.moqUnit || item.unit || 'Piece';
    return `${qty} ${unit}${qty !== 1 && !unit.endsWith('s') ? 's' : ''}`;
  };

  const S = {
    overlay: { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { backgroundColor: D.surface, borderRadius: '16px', padding: '12px 16px 32px', width: '90%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    handle: { width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '8px auto 12px' },
    btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
    btnCancel: { display: 'block', width: '100%', padding: '10px', backgroundColor: '#fce8e6', color: '#ba1a1a', border: '1px solid #f9bdbb', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 12 },
  };

  const orderSteps = ['Pending', 'Approved', 'Dispatched', 'Delivered'];
  let normalizedStatus = order.status || 'Pending';
  if (normalizedStatus === 'Processing') normalizedStatus = 'Approved';
  if (normalizedStatus === 'Shipped') normalizedStatus = 'Dispatched';
  const currentStep = orderSteps.indexOf(normalizedStatus) !== -1 ? orderSteps.indexOf(normalizedStatus) : 0;

  return (
    <>
      {showDispatch && (
        <div style={S.overlay}>
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
          {(() => {
            const thumbUrl = order.items?.[0]?.photoUrl || null;
            return thumbUrl ? (
              <img src={thumbUrl} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} alt="" />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#e8edf5', color: '#031632', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {order.supplierFirm?.[0]?.toUpperCase() || '?'}
              </div>
            );
          })()}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>#{order.orderNumber || order.id.slice(-6).toUpperCase()}</span>
              <span style={{ ...getStatusStyle(order.status || 'Pending'), padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{order.status || 'Pending'}</span>
              {pLabel && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, backgroundColor: pLabel.bg, color: pLabel.color }}>{pLabel.text}</span>}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: D.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.supplierFirm} · {totalItems} item{totalItems !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              {order.totalAmount > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>₹{order.totalAmount.toLocaleString('en-IN')}</span>
              )}
              <span style={{ fontSize: 11, color: D.textSecondary }}>{order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        {expanded && (
          <div style={{ borderTop: `1px solid ${D.borderLight}`, padding: '10px 14px 14px', backgroundColor: '#fafbfc' }}>

            {/* Timeline */}
            {order.status !== 'Cancelled' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 11, left: 20, right: 20, height: 2, backgroundColor: D.borderLight, zIndex: 0 }} />
                <div style={{ position: 'absolute', top: 11, left: 20, width: `${(currentStep / (orderSteps.length - 1)) * 100}%`, height: 2, backgroundColor: D.success, zIndex: 1, transition: 'width 0.3s ease' }} />
                {orderSteps.map((step, index) => {
                  const isCompleted = index <= currentStep;
                  return (
                    <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, gap: 4 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: isCompleted ? D.success : D.surface, border: `2px solid ${isCompleted ? D.success : D.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isCompleted && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: isCompleted ? D.textPrimary : D.textSecondary }}>{step}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '8px', backgroundColor: '#fce8e6', color: '#ba1a1a', borderRadius: 6, fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>
                This order was cancelled.
              </div>
            )}

            {/* Items */}
            {order.items?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                {item.photoUrl && <img src={item.photoUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{item.productName}</span>
                  {item.designNo && <span style={{ fontSize: 11, color: D.textSecondary }}> · DN{item.designNo}</span>}
                  {item.cutLabel && <span style={{ fontSize: 11, color: D.textSecondary }}> · {item.cutLabel}</span>}
                  {item.size && <span style={{ fontSize: 11, color: D.textSecondary }}> · Size {item.size}</span>}
                </div>
                {/* ✅ FIX: fmtQty ab sahi unit dikhata hai */}
                <span style={{ fontSize: 12, color: D.navy, flexShrink: 0, fontWeight: 700 }}>{fmtQty(item)}</span>
              </div>
            ))}

            {order.nightyDetails && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: D.textSecondary }}>
                {order.nightyDetails.totalSets} sets · {order.nightyDetails.packingType} sets/bale · <b style={{ color: D.navy }}>{order.nightyDetails.totalBales} bale(s)</b>
                {order.nightyDetails.looseSets > 0 && ` · ${order.nightyDetails.looseSets} loose`}
              </p>
            )}

            {hasDispatchData && (
              <button style={{ ...S.btnPrimary, marginTop: 12, padding: '10px', fontSize: 13, backgroundColor: D.navyMid }} onClick={() => setShowDispatch(true)}>
                📦 View Dispatch Details
              </button>
            )}

            {onReorder && (
              <button
                style={{ ...S.btnGhost, marginTop: 12, padding: '10px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={(e) => { e.stopPropagation(); onReorder(order); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                Re-order Items
              </button>
            )}

            {order.status === 'Pending' && onCancel && (
              <button
                style={S.btnCancel}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to cancel this order?')) onCancel(order.id);
                }}
              >
                Cancel Order
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default OrderCard;