import React from 'react';
import { D } from '../../constants/design';
import TextInput from '../shared/TextInput';

export default function AdminEditUserModal({ selectedUser, setSelectedUser, onSave, onCancel }) {
  if (!selectedUser) return null;

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: D.navy }}>Edit User — {selectedUser.firmName}</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <TextInput label="Firm Name" value={selectedUser.firmName || ''} onChange={v => setSelectedUser({ ...selectedUser, firmName: v })} />
          </div>
          <TextInput label="Contact Person" value={selectedUser.contactPerson || ''} onChange={v => setSelectedUser({ ...selectedUser, contactPerson: v })} />
          <TextInput label="Mobile" value={selectedUser.mobile || ''} onChange={v => setSelectedUser({ ...selectedUser, mobile: v })} />
          <TextInput label="City" value={selectedUser.city || ''} onChange={v => setSelectedUser({ ...selectedUser, city: v })} />
          <TextInput label="State" value={selectedUser.state || ''} onChange={v => setSelectedUser({ ...selectedUser, state: v })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <TextInput label="GST Number" value={selectedUser.gstNumber || ''} onChange={v => setSelectedUser({ ...selectedUser, gstNumber: v })} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={styles.btnApprove} onClick={onSave}>Save Changes</button>
          <button style={styles.btnEdit} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { backgroundColor: 'white', padding: 25, borderRadius: 16, width: '90%', maxWidth: 500, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
  btnEdit: { backgroundColor: '#64748b', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
};