import React, { useState, useEffect } from 'react';

const D = { navy: '#031632', navyMid: '#1a2b48', gold: '#775a19', bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c' };

function getStatusStyle(status) {
  if (status === 'Delivered') return { bg: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped' || status === 'Processing') return { bg: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Partially Dispatched') return { bg: '#fff3e0', color: '#7a5200' };
  if (status === 'Cancelled') return { bg: '#fce8e6', color: '#ba1a1a' };
  return { bg: '#fff3e0', color: '#854d0e' };
}

function formatDateTime(createdAt) {
  const date = createdAt?.toDate?.();
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

async function exportOrderPDF(order) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy = [3, 22, 50], gray = [100, 116, 139], lightGray = [241, 245, 249], W = 210, margin = 16;
  pdf.setFillColor(...navy); pdf.rect(0, 0, W, 38, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
  pdf.text('JAIN AGENCY', margin, 15);
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200, 200, 200);
  pdf.text('Supplier Order Receipt', margin, 22);
  pdf.setFontSize(11); pdf.setTextColor(255, 255, 255);
  pdf.text(order.orderNumber ? `Order #${order.orderNumber}` : `Order #${order.id.slice(-6).toUpperCase()}`, W - margin, 15, { align: 'right' });
  pdf.setFontSize(9); pdf.setTextColor(200, 200, 200);
  pdf.text(order.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || '', W - margin, 22, { align: 'right' });
  let y = 46;
  pdf.setFillColor(...lightGray); pdf.roundedRect(margin, y, W - margin * 2, 22, 3, 3, 'F');
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...navy);
  pdf.text('Buyer:', margin + 4, y + 8); pdf.setFont('helvetica', 'normal');
  pdf.text(order.buyerFirm || '—', margin + 18, y + 8);
  pdf.setFont('helvetica', 'bold'); pdf.text('Status:', margin + 4, y + 17);
  pdf.setFont('helvetica', 'normal'); pdf.text(order.status || 'Pending', margin + 20, y + 17);
  y += 30;
  pdf.setTextColor(...navy); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text('ORDER ITEMS', margin, y); y += 6;
  pdf.setFillColor(...navy); pdf.rect(margin, y, W - margin * 2, 8, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
  pdf.text('Product', margin + 3, y + 5.5); pdf.text('Design/Size', margin + 85, y + 5.5);
  pdf.text('Ordered', margin + 130, y + 5.5); pdf.text('Dispatched', margin + 155, y + 5.5);
  pdf.text('Unit', margin + 178, y + 5.5); y += 8;
  (order.items || []).forEach((item, idx) => {
    if (idx % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, W - margin * 2, 7, 'F'); }
    pdf.setTextColor(...navy); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text((item.productName || '').slice(0, 32), margin + 3, y + 5);
    const ds = item.designNo ? `DN${item.designNo}` : item.size ? `Sz ${item.size}` : '—';
    pdf.text(ds, margin + 85, y + 5);
    pdf.text(String(item.orderedQty || item.quantity || item.sets || 0), margin + 130, y + 5);
    pdf.setTextColor(22, 163, 74); pdf.text(String(item.dispatchedQty || 0), margin + 155, y + 5);
    pdf.setTextColor(...gray); pdf.text(item.moqUnit || item.unit || 'Piece', margin + 178, y + 5); y += 7;
  });
  if (order.nightyDetails) {
    y += 3; pdf.setTextColor(...gray); pdf.setFontSize(8);
    pdf.text(`Packing: ${order.nightyDetails.totalSets} sets · ${order.nightyDetails.packingType}/bale · ${order.nightyDetails.totalBales} bales`, margin, y); y += 6;
  }
  const shipments = order.shipments || [];
  if (shipments.length > 0) {
    y += 6; pdf.setTextColor(...navy); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
    pdf.text('DISPATCH HISTORY', margin, y); y += 6;
    shipments.forEach((ship, idx) => {
      if (y > 250) { pdf.addPage(); y = 20; }
      pdf.setFillColor(...lightGray); pdf.roundedRect(margin, y, W - margin * 2, 9, 2, 2, 'F');
      pdf.setFillColor(...navy); pdf.roundedRect(margin, y, 3, 9, 1, 1, 'F');
      pdf.setTextColor(...navy); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text(`Dispatch ${idx + 1}${ship.billDate ? ` (${ship.billDate})` : ''}`, margin + 6, y + 6.5); y += 9;
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...gray);
      const det = [ship.billNo && `Bill: ${ship.billNo}`, ship.transport && `Transport: ${ship.transport}`, ship.lrNo && `LR: ${ship.lrNo}`].filter(Boolean).join('   ');
      pdf.text(det, margin + 4, y + 5); y += 8;
      (ship.items || []).forEach(i => { pdf.setTextColor(...navy); pdf.setFontSize(8); pdf.text(`• ${i.productName}${i.size ? ` (${i.size})` : ''}: ${i.qty} ${i.unit || ''}`, margin + 6, y + 4); y += 6; });
      y += 2;
    });
  }
  y = 285; pdf.setFillColor(...navy); pdf.rect(0, y, W, 12, 'F');
  pdf.setTextColor(200, 200, 200); pdf.setFontSize(8);
  pdf.text('Jain Agency — Supplier Copy', margin, y + 8);
  pdf.text('Page 1', W - margin, y + 8, { align: 'right' });
  pdf.save(`Order_${order.orderNumber || order.id.slice(-6).toUpperCase()}.pdf`);
}

function SupplierOrderCard({ order, onApprove, onReject, highlightId }) {
  const [expanded, setExpanded] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [actioning, setActioning] = useState(false);

  const shipments = order.shipments || [];
  const status = order.status || 'Pending';
  const ss = getStatusStyle(status);
  const thumbUrl = order.items?.[0]?.photoUrl || null;
  const orderLabel = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(-6).toUpperCase()}`;
  const transportName = order.transportDetails?.name || 'No transport';
  const deliveryCity = order.transportDetails?.deliveryAddress || '';

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setShowDispatch(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Dispatch Details Modal */}
      {showDispatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: D.surface, borderRadius: 16, padding: '16px 20px 28px', width: '90%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700, color: D.navy }}>Dispatch Details</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${D.borderLight}` }}>
              <span style={{ fontSize: 13, color: D.textSecondary }}>Order ID</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{orderLabel}</span>
            </div>
            {shipments.map((ship, idx) => (
              <div key={idx} style={{ marginTop: 14, paddingBottom: 4, borderBottom: idx < shipments.length - 1 ? `2px solid ${D.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 18, backgroundColor: D.gold, borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: D.navy }}>Dispatch {idx + 1}{ship.billDate ? ` · ${ship.billDate}` : ''}</span>
                </div>
                {[['Bill No', ship.billNo], ['Transport', ship.transport], ['LR No', ship.lrNo], ['LR Date', ship.lrDate]]
                  .filter(([, v]) => v).map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                      <span style={{ fontSize: 13, color: D.textSecondary }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                {ship.items?.length > 0 && (
                  <div style={{ marginTop: 8, backgroundColor: D.bg, borderRadius: 8, padding: '8px 10px' }}>
                    {ship.items.map((item, iIdx) => (
                      <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                        <span style={{ fontSize: 12, color: D.textPrimary }}>{item.productName}{item.size ? ` (${item.size})` : ''}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>{item.qty} {item.unit || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setShowDispatch(false)} style={{ display: 'block', width: '100%', padding: '13px', marginTop: 20, backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      <div id={`row-${order.id}`} style={{ backgroundColor: order.id === highlightId ? '#fff9c4' : D.surface, borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 6px rgba(3,22,50,0.07)', border: `1px solid ${D.borderLight}`, overflow: 'hidden' }}>

        {/* Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${D.borderLight}` }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: D.navy }}>{orderLabel}</span>
          <span style={{ fontSize: 11, color: D.textSecondary }}>{formatDateTime(order.createdAt)}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, backgroundColor: ss.bg, color: ss.color, flexShrink: 0 }}>{status}</span>
        </div>

        {/* Middle Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${D.borderLight}` }}>
          {thumbUrl ? (
            <img src={thumbUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#e8edf5', color: D.navy, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {order.buyerFirm?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: D.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.buyerFirm}</p>
            <p style={{ margin: '2px 0', fontSize: 13, color: D.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.items?.[0]?.productName || '—'}</p>
            <p style={{ margin: 0, fontSize: 12, color: D.textSecondary }}>
              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
              {order.totalAmount > 0
                ? <span>{'  •  '}<b style={{ color: D.navy }}>₹{order.totalAmount.toLocaleString('en-IN')}</b></span>
                : '  •  ₹N/A'
              }
            </p>
          </div>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>🚚</span>
            <span style={{ fontSize: 12, color: D.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {transportName}{deliveryCity ? ` · ${deliveryCity}` : ''}
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: D.navy, backgroundColor: 'transparent', border: `1px solid ${D.borderLight}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', marginLeft: 8 }}
          >
            {expanded ? 'Close ✕' : 'Details →'}
          </button>
        </div>

        {/* Approve / Reject — always visible when Pending */}
        {status === 'Pending' && (
          <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
            <button disabled={actioning} onClick={async () => { setActioning(true); await onApprove(order); setActioning(false); }}
              style={{ flex: 1, padding: '9px', backgroundColor: D.success, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✓ Approve</button>
            <button disabled={actioning} onClick={async () => { setActioning(true); await onReject(order); setActioning(false); }}
              style={{ flex: 1, padding: '9px', backgroundColor: '#fce8e6', color: D.error, border: `1px solid ${D.error}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕ Reject</button>
          </div>
        )}

        {/* Expanded Section */}
        {expanded && (
          <div style={{ borderTop: `1px solid ${D.borderLight}`, padding: '12px 14px 14px', backgroundColor: '#fafbfc' }}>
            {order.items?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                {item.photoUrl && <img src={item.photoUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{item.productName}</span>
                  {item.designNo && <span style={{ fontSize: 11, color: D.textSecondary }}> · DN{item.designNo}</span>}
                  {item.size && <span style={{ fontSize: 11, color: D.textSecondary }}> · Size {item.size}</span>}
                  {item.cutLabel && <span style={{ fontSize: 11, color: D.textSecondary }}> · {item.cutLabel}</span>}
                </div>
                <span style={{ fontSize: 11, color: D.navy, fontWeight: 700, flexShrink: 0 }}>
                  {item.sets ? `${item.sets} Set${item.sets !== 1 ? 's' : ''}` : `${item.orderedQty || item.quantity || 0} ${item.unit || 'pc'}`}
                </span>
              </div>
            ))}
            {order.nightyDetails && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: D.textSecondary }}>
                {order.nightyDetails.totalSets} sets · {order.nightyDetails.packingType} sets/bale · <b style={{ color: D.navy }}>{order.nightyDetails.totalBales} bale(s)</b>
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => exportOrderPDF(order)} style={{ flex: 1, padding: '9px', backgroundColor: D.navyMid, color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📄 Export PDF</button>
              {shipments.length > 0 && (
                <button onClick={() => setShowDispatch(true)} style={{ flex: 1, padding: '9px', backgroundColor: '#e8edf5', color: D.navy, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📦 Dispatch Details</button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default SupplierOrderCard;
