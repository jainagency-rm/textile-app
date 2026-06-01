import React, { useState } from 'react';

const D = {
  navy: '#031632', textSecondary: '#44474d', textPrimary: '#191c1d',
  borderLight: '#e7e8e9', surface: '#ffffff', bg: '#f8f9fa',
  error: '#ba1a1a', success: '#1a6b3c',
};

function getStatusStyle(status) {
  if (status === 'Delivered') return { bg: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped' || status === 'Partially Dispatched') return { bg: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Processing') return { bg: '#fef7e0', color: '#7a5200' };
  if (status === 'Cancelled') return { bg: '#fce8e6', color: '#ba1a1a' };
  return { bg: '#fff3e0', color: '#854d0e' };
}

function formatDateTime(createdAt) {
  const date = createdAt?.toDate?.();
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function OrderListCard({ order, onCancel, onReorder, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const status = order.status || 'Pending';
  const ss = getStatusStyle(status);
  const thumbUrl = order.items?.[0]?.photoUrl || null;
  const orderLabel = `#${order.orderNumber || order.id.slice(-6).toUpperCase()}`;
  const transportName = order.transportDetails?.name || 'No transport';
  const deliveryCity = order.transportDetails?.deliveryAddress || '';

  return (
    <div style={{ backgroundColor: D.surface, borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 6px rgba(3,22,50,0.07)', border: `1px solid ${D.borderLight}`, overflow: 'hidden' }}>

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
            {order.supplierFirm?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: D.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.supplierFirm}</p>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {onReorder && (
              <button
                style={{ display: 'block', width: '100%', padding: '11px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.borderLight}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onReorder(order); }}
              >
                ↺ Re-order Items
              </button>
            )}
            {onEdit && order.status === 'Pending' && (
              <button
                style={{ display: 'block', width: '100%', padding: '11px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.borderLight}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onEdit(order); }}
              >
                ✏️ Edit Order
              </button>
            )}
            {onCancel && order.status === 'Pending' && (
              <button
                style={{ display: 'block', width: '100%', padding: '10px', backgroundColor: '#fce8e6', color: '#ba1a1a', border: '1px solid #f9bdbb', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to cancel this order?')) onCancel(order.id);
                }}
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ orders, onCancel, onReorder, onEdit }) {
  const sorted = [...orders].sort((a, b) => {
    const aNum = a.orderNumber;
    const bNum = b.orderNumber;
    if (aNum && bNum) return bNum - aNum;
    if (aNum) return -1;
    if (bNum) return 1;
    const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
    return bTime - aTime;
  });

  return (
    <div style={{ padding: '8px 16px' }}>
      {sorted.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: D.textSecondary }}>
          <p style={{ fontSize: 15 }}>No orders yet</p>
        </div>
      ) : (
        sorted.map(order => (
          <OrderListCard
            key={order.id}
            order={order}
            onCancel={onCancel}
            onReorder={onReorder}
            onEdit={onEdit}
          />
        ))
      )}
    </div>
  );
}

export default OrdersTab;
