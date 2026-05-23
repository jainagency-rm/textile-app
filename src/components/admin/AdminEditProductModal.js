import React from 'react';
import { D } from '../../constants/design';
import { SIZES, UNITS, NIGHTY_CATEGORIES, STITCHED_CATEGORIES, CHUDIDAR_CATEGORY } from '../../constants/product';
import TextInput from '../shared/TextInput';

export default function AdminEditProductModal({ 
  editingProduct, setEditingProduct, categories, 
  onSave, onCancel, uploadingImage, 
  onImageUpload, onImageDelete 
}) {
  if (!editingProduct) return null;

  const getProductImages = (product) => {
    if (!product) return [];
    if (product.imageUrls && Array.isArray(product.imageUrls))
      return product.imageUrls.map(u => typeof u === 'string' ? u : u.url).filter(Boolean);
    if (product.imageUrl) return [product.imageUrl];
    return [];
  };

  const toggleEditSize = (size) => {
    const current = editingProduct.sizes || [];
    setEditingProduct({ ...editingProduct, sizes: current.includes(size) ? current.filter(s => s !== size) : [...current, size] });
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: D.navy }}>Edit — {editingProduct.name}</h3>

        <label style={styles.label}>Photos</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {getProductImages(editingProduct).map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={url} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6 }} />
              <button onClick={() => onImageDelete(url)}
                style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: D.error, color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" multiple style={styles.inputFull} onChange={e => onImageUpload(e.target.files)} />

        <TextInput label="Product Name" value={editingProduct.name} onChange={v => setEditingProduct({ ...editingProduct, name: v })} />

        <label style={styles.label}>Category</label>
        <select style={styles.inputFull} value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TextInput label="Price (₹)" type="number" value={editingProduct.price} onChange={v => setEditingProduct({ ...editingProduct, price: v })} />
          <TextInput label="MOQ" type="number" value={editingProduct.moq} onChange={v => setEditingProduct({ ...editingProduct, moq: v })} />
        </div>

        <label style={styles.label}>Unit</label>
        <select style={styles.inputFull} value={editingProduct.unit || 'Piece'} onChange={e => setEditingProduct({ ...editingProduct, unit: e.target.value })}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <label style={styles.label}>Description</label>
        <textarea style={{ ...styles.inputFull, height: 60, resize: 'vertical' }} value={editingProduct.description || ''} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />

        {NIGHTY_CATEGORIES.includes(editingProduct.category) && (
          <>
            <label style={styles.label}>Cut</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['2/70', '2/90', '3/20'].map(cut => (
                <button key={cut} type="button"
                  style={{ padding: '6px 14px', border: '2px solid', borderColor: editingProduct.cut === cut ? D.navy : D.borderLight, borderRadius: 6, cursor: 'pointer', backgroundColor: editingProduct.cut === cut ? D.navy : 'white', color: editingProduct.cut === cut ? 'white' : D.textPrimary }}
                  onClick={() => setEditingProduct({ ...editingProduct, cut })}>{cut}</button>
              ))}
            </div>
          </>
        )}

        {((STITCHED_CATEGORIES && STITCHED_CATEGORIES.includes(editingProduct.category)) || editingProduct.category === CHUDIDAR_CATEGORY) && (
          <>
            <TextInput label="Material" value={editingProduct.material || ''} onChange={v => setEditingProduct({ ...editingProduct, material: v })} />
            <label style={styles.label}>Sizes</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SIZES.map(size => (
                <button key={size} type="button"
                  style={{ padding: '5px 10px', border: '2px solid', borderColor: (editingProduct.sizes || []).includes(size) ? D.error : D.borderLight, borderRadius: 6, cursor: 'pointer', backgroundColor: (editingProduct.sizes || []).includes(size) ? D.error : 'white', color: (editingProduct.sizes || []).includes(size) ? 'white' : D.textPrimary, fontSize: 13 }}
                  onClick={() => toggleEditSize(size)}>{size}</button>
              ))}
            </div>
          </>
        )}

        {editingProduct.category === CHUDIDAR_CATEGORY && (
          <>
            <TextInput label="Top Material" value={editingProduct.chudidarTopMaterial || ''} onChange={v => setEditingProduct({ ...editingProduct, chudidarTopMaterial: v })} />
            <TextInput label="Bottom Material" value={editingProduct.chudidarBottomMaterial || ''} onChange={v => setEditingProduct({ ...editingProduct, chudidarBottomMaterial: v })} />
            <TextInput label="Dupatta Material" value={editingProduct.chudidarDupattaMaterial || ''} onChange={v => setEditingProduct({ ...editingProduct, chudidarDupattaMaterial: v })} />
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={styles.btnApprove} onClick={onSave} disabled={uploadingImage}>
            {uploadingImage ? 'Uploading...' : 'Save Changes'}
          </button>
          <button style={styles.btnEdit} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { backgroundColor: 'white', padding: 25, borderRadius: 16, width: '90%', maxWidth: 540, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
  label: { fontSize: 12, color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4, marginTop: 10 },
  inputFull: { padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, width: '100%', boxSizing: 'border-box', fontSize: 14, outline: 'none' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
  btnEdit: { backgroundColor: '#64748b', color: 'white', border: 'none', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, flex: 1 },
};