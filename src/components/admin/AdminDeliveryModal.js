import React from 'react';
import { D } from '../../constants/design';
import TextInput from '../shared/TextInput';

export default function AdminDeliveryModal({ 
  deliveryModal, deliveryStatus, setDeliveryStatus, 
  shippingForm, setShippingForm, onSave, onCancel 
}) {
  if (!deliveryModal) return null;

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: D.navy }}>Update Order Status</h3>
        <p style={{ fontSize: 13, color: D.textSecondary, margin: '0 0 12px' }}>
          Buyer: <b>{deliveryModal.buyerFirm}</b> | Supplier: <b>{deliveryModal.supplierFirm}</b>
        </p>

        <label style={styles.label}>Status</label>
        <select style={styles.inputFull} value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped (Add Dispatch)</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 12px' }}>
          Note: "Delivered" and "Partially Dispatched" are set automatically based on dispatch quantities.
        </p>

        {deliveryStatus === 'Shipped' && (
          <div style={{ marginTop: 12, backgroundColor: '#f8fafc', padding: 16, borderRadius: 10 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 'bold', fontSize: 13, color: D.navy }}>New Dispatch Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TextInput label="Bill No *" value={shippingForm.billNo} onChange={v => setShippingForm({ ...shippingForm, billNo: v })} placeholder="Bill No" />
              <div>
                <label style={styles.label}>Bill Date</label>
                <input type="date" style={styles.inputFull} value={shippingForm.billDate} onChange={e => setShippingForm({ ...shippingForm, billDate: e.target.value })} />
              </div>
              <TextInput label="Transport" value={shippingForm.transport} onChange={v => setShippingForm({ ...shippingForm, transport: v })} placeholder="Transport" />
              <TextInput label="LR No" value={shippingForm.lrNo} onChange={v => setShippingForm({ ...shippingForm, lrNo: v })} placeholder="LR No" />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={styles.label}>LR Date</label>
                <input type="date" style={{ ...styles.inputFull, maxWidth: 200 }} value={shippingForm.lrDate} onChange={e => setShippingForm({ ...shippingForm, lrDate: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: D.navy, margin: '0 0 10px' }}>Quantity to Dispatch Now</p>
              {shippingForm.dispatchItems.map((item, idx) => {
                const remaining = item.orderedQty - item.previouslyDispatched;
                const isDisabled = remaining <= 0;
                return (
                  <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', opacity: isDisabled ? 0.5 : 1, backgroundColor: isDisabled ? '#f1f5f9' : 'white', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: D.navy }}>
                        {item.productName}{item.size ? ` (${item.size})` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: D.textSecondary, marginTop: 2 }}>
                        Ordered: <b>{item.orderedQty} {item.unit}</b> | Prev: <b style={{ color: D.success }}>{item.previouslyDispatched}</b> | Rem: <b style={{ color: isDisabled ? '#94a3b8' : D.error }}>{remaining}</b>
                      </div>
                    </div>
                    <div>
                      <label style={{ ...styles.label, marginBottom: 2 }}>Now</label>
                      <input type="number" min="0" max={remaining}
                        value={item.dispatchingNow}
                        disabled={isDisabled}
                        style={{ width: 72, padding: '7px', borderRadius: 6, border: '1px solid #d1d5db', backgroundColor: isDisabled ? '#e2e8f0' : 'white', textAlign: 'center', fontSize: 14 }}
                        onChange={e => {
                          let val = Math.max(0, Math.min(Number(e.target.value), remaining));
                          const updated = [...shippingForm.dispatchItems];
                          updated[idx] = { ...updated[idx], dispatchingNow: val };
                          setShippingForm({ ...shippingForm, dispatchItems: updated });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={styles.btnApprove} onClick={onSave}>Save Status</button>
          <button style={styles.btnEdit} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { backgroundColor: 'white', padding: 25, borderRadius: 16, width: '90%', maxWidth: 520, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
  label: { fontSize: 12, color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4, marginTop: 10 },
  inputFull: { padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, width: '100%', boxSizing: 'border-box', fontSize: 14, outline: 'none' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
  btnEdit: { backgroundColor: '#64748b', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
};