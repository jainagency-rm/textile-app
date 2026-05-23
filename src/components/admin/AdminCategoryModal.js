import React from 'react';
import { D } from '../../constants/design';
import TextInput from '../shared/TextInput';

export default function AdminCategoryModal({ editingCategory, setEditingCategory, onSave, onCancel }) {
  if (!editingCategory) return null;

  const templates = [
    { id: 'sets', label: 'Fixed Sets', desc: 'e.g. Nighty, Lingerie', icon: '📦' },
    { id: 'stitched', label: 'Stitched Garments', desc: 'e.g. Kurti, Dress', icon: '👕' },
    { id: 'unstitched', label: 'Unstitched Suits', desc: 'e.g. 3pc Chudidar', icon: '🧵' },
    { id: 'running', label: 'Running Fabric', desc: 'e.g. Thaan, Lump', icon: '📜' },
  ];

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: D.navy }}>Edit Category</h3>

        <TextInput
          label="Category Name *"
          value={editingCategory.name}
          onChange={v => setEditingCategory({ ...editingCategory, name: v })}
          placeholder="Category Name"
        />

        <label style={{ fontSize: 13, color: D.textSecondary, fontWeight: 700, display: 'block', marginBottom: 4, marginTop: 16 }}>Behavior Template *</label>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 10px' }}>
          Note: Changing template only affects new products — existing products are not changed.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {templates.map(t => {
            const isActive = editingCategory.template === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setEditingCategory({ ...editingCategory, template: t.id })}
                style={{
                  padding: '12px 10px', border: '2px solid',
                  borderColor: isActive ? D.navy : D.borderLight,
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  backgroundColor: isActive ? D.navy : 'white',
                  color: isActive ? 'white' : D.textPrimary,
                }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t.desc}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            style={styles.btnApprove}
            disabled={!editingCategory.name.trim()}
            onClick={onSave}>
            Save Changes
          </button>
          <button style={styles.btnEdit} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { backgroundColor: 'white', padding: 25, borderRadius: 16, width: '90%', maxWidth: 440, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
  btnEdit: { backgroundColor: '#64748b', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
};