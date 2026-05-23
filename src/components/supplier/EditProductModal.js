import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';

const UNITS = ['Piece', 'Set', 'Dozen', 'Meter', 'KG', 'Yard', 'Roll', 'Bale', 'Bundle', 'Box', 'Carton'];

const D = { navy: '#031632', gold: '#775a19', bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c', warning: '#7a5200' };

function SectionBox({ title, children }) {
  return (
    <div style={{ backgroundColor: D.bg, borderRadius: 12, padding: 14, border: `1px solid ${D.borderLight}`, marginBottom: 12 }}>
      {title && <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: D.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>}
      {children}
    </div>
  );
}

function LabelRow({ label, required, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${D.borderLight}` }}>
      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 90, flexShrink: 0 }}>{label}{required && <span style={{ color: D.error }}>*</span>}</span>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <LabelRow label={label} required={required}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }} />
    </LabelRow>
  );
}

function EditProductModal({ product, onClose, onSaved, onDeleted }) {
  const [activeTab, setActiveTab] = useState(0);

  const [info, setInfo] = useState(() => {
    let mode = product.designMode;
    if (!mode) {
      if (product.isNighty) mode = 'nighty';
      else if (product.template === 'running') mode = 'running';
      else mode = 'fullset';
    }
    let urls = product.imageUrls || [];
    urls = urls.map(img => typeof img === 'string' ? { url: img, dnNumber: '' } : img);
    if (urls.length === 0 && product.imageUrl) urls = [{ url: product.imageUrl, dnNumber: '' }];
    return { ...product, designMode: mode, imageUrls: urls };
  });

  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loadingTab2, setLoadingTab2] = useState(false);
  const [nightyCuts, setNightyCuts] = useState([]);
  const [selectionDesigns, setSelectionDesigns] = useState([]);
  const [uploadingTab2, setUploadingTab2] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [pendingStock, setPendingStock] = useState(() => product.fullSetStock || {});

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 2500); };
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 3000); };

  // FIX 1: useCallback so loadTab2Data can be in useEffect dependency array
  const loadTab2Data = useCallback(async () => {
    setLoadingTab2(true);
    try {
      if (info.designMode === 'nighty') {
        const cutsSnap = await getDocs(collection(db, 'products', product.id, 'cuts'));
        const cutsData = await Promise.all(
          cutsSnap.docs.map(async (cutDoc) => {
            const designsSnap = await getDocs(collection(db, 'products', product.id, 'cuts', cutDoc.id, 'designs'));
            return { id: cutDoc.id, ...cutDoc.data(), designs: designsSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
          })
        );
        setNightyCuts(cutsData);
      } else if (info.designMode === 'design') {
        const designsSnap = await getDocs(collection(db, 'products', product.id, 'designs'));
        setSelectionDesigns(designsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) { showError('Failed to load: ' + err.message); }
    setLoadingTab2(false);
  }, [info.designMode, product.id]); // only re-creates if designMode or id changes

  // ESC key close
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // FIX 2: loadTab2Data now stable via useCallback, safe to include in deps
  useEffect(() => {
    setError(null);
    if (activeTab === 1) loadTab2Data();
  }, [activeTab, loadTab2Data]);

  const uploadPhotoModal = async (file) => {
    const userId = auth.currentUser?.uid || 'unknown_user';
    const fileRef = ref(storage, `designs/${userId}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const deletePhotoFromStorage = async (url) => {
    if (!url) return;
    try { await deleteObject(ref(storage, url)); } catch (_) {}
  };

  // ── Delete product ────────────────────────────────────────
  const handleDeleteProduct = async () => {
    if (!window.confirm(`"${product.name}" ko permanently delete karna chahte ho?\n\nYeh action undo nahi hoga.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      // Delete subcollections + storage
      if (info.designMode === 'nighty') {
        const cutsSnap = await getDocs(collection(db, 'products', product.id, 'cuts'));
        for (const cutDoc of cutsSnap.docs) {
          const designsSnap = await getDocs(collection(db, 'products', product.id, 'cuts', cutDoc.id, 'designs'));
          for (const dDoc of designsSnap.docs) {
            const photoUrl = dDoc.data().photoUrl;
            if (photoUrl) { try { await deleteObject(ref(storage, photoUrl)); } catch (_) {} }
            await deleteDoc(dDoc.ref);
          }
          await deleteDoc(cutDoc.ref);
        }
      } else if (info.designMode === 'design') {
        const designsSnap = await getDocs(collection(db, 'products', product.id, 'designs'));
        for (const dDoc of designsSnap.docs) {
          const photoUrl = dDoc.data().photoUrl;
          if (photoUrl) { try { await deleteObject(ref(storage, photoUrl)); } catch (_) {} }
          await deleteDoc(dDoc.ref);
        }
      }
      // Delete main product images from storage
      const imageUrls = info.imageUrls || [];
      for (const img of imageUrls) {
        const url = typeof img === 'string' ? img : img.url;
        if (url) { try { await deleteObject(ref(storage, url)); } catch (_) {} }
      }
      if (info.imageUrl && !imageUrls.length) {
        try { await deleteObject(ref(storage, info.imageUrl)); } catch (_) {}
      }
      await deleteDoc(doc(db, 'products', product.id));
      if (onDeleted) onDeleted(product.id);
    } catch (err) {
      showError('Delete failed: ' + err.message);
      setIsDeleting(false);
    }
  };

  // ── Basic info save ───────────────────────────────────────
  const handleSaveBasicInfo = async () => {
    setIsSavingBasic(true); setError(null);
    try {
      const payload = { name: info.name, moq: Number(info.moq) || 0, unit: info.unit, description: info.description || '' };
      if (info.isNighty) {
        payload.cutRates = info.cutRates || {};
        const firstRate = Object.values(info.cutRates || {})[0];
        if (firstRate) payload.price = Number(firstRate);
      } else { payload.price = Number(info.price) || 0; }
      if (info.isStitched) payload.material = info.material || '';
      if (info.template === 'running') { payload.width = info.width || ''; payload.runningMeters = Number(info.runningMeters) || 0; }
      await updateDoc(doc(db, 'products', product.id), payload);
      const updated = { ...info, ...payload };
      setInfo(updated);
      onSaved(updated, false);
      showSuccess('Basic info saved!');
    } catch (err) { showError('Save failed: ' + err.message); }
    setIsSavingBasic(false);
  };

  // ── Nighty designs ────────────────────────────────────────
  const handleNightyDesignUpload = async (cutId, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const cut = nightyCuts.find(c => c.id === cutId);
      const existingCount = cut?.designs?.length || 0;
      const newDesigns = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadPhotoModal(files[i]);
        const newDesign = { designNo: existingCount + i + 1, dnNumber: '', sets: 0, photoUrl: url, addedAt: new Date() };
        const docRef = await addDoc(collection(db, 'products', product.id, 'cuts', cutId, 'designs'), newDesign);
        newDesigns.push({ id: docRef.id, ...newDesign });
      }
      setNightyCuts(prev => prev.map(c => c.id === cutId ? { ...c, designs: [...c.designs, ...newDesigns] } : c));
      showSuccess(`${newDesigns.length} design(s) added`);
    } catch (err) { showError(err.message); }
    setUploadingTab2(false);
  };

  const handleNightyDesignUpdate = async (cutId, designId, field, value) => {
    try {
      await updateDoc(doc(db, 'products', product.id, 'cuts', cutId, 'designs', designId), { [field]: value });
      setNightyCuts(prev => prev.map(c => c.id === cutId ? { ...c, designs: c.designs.map(d => d.id === designId ? { ...d, [field]: value } : d) } : c));
    } catch (err) { showError(err.message); }
  };

  const handleNightyDesignDelete = async (cutId, designId, photoUrl) => {
    if (!window.confirm('Delete this design?')) return;
    try {
      await deleteDoc(doc(db, 'products', product.id, 'cuts', cutId, 'designs', designId));
      await deletePhotoFromStorage(photoUrl);
      setNightyCuts(prev => prev.map(c => c.id === cutId ? { ...c, designs: c.designs.filter(d => d.id !== designId) } : c));
      showSuccess('Design deleted');
    } catch (err) { showError(err.message); }
  };

  // ── Selection designs ─────────────────────────────────────
  const handleSelectionDesignUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const existingCount = selectionDesigns.length;
      const newDesigns = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadPhotoModal(files[i]);
        const defaultStock = info.isStitched ? (info.sizes || []).reduce((acc, size) => ({ ...acc, [size]: 0 }), {}) : { sets: 0 };
        const newDesign = { designNo: existingCount + i + 1, dnNumber: '', stock: defaultStock, photoUrl: url, addedAt: new Date() };
        const docRef = await addDoc(collection(db, 'products', product.id, 'designs'), newDesign);
        newDesigns.push({ id: docRef.id, ...newDesign });
      }
      setSelectionDesigns(prev => [...prev, ...newDesigns]);
      showSuccess(`${newDesigns.length} design(s) added`);
    } catch (err) { showError(err.message); }
    setUploadingTab2(false);
  };

  const handleSelectionDesignUpdate = async (designId, field, value, isStock = false) => {
    try {
      const updateData = isStock ? { [`stock.${field}`]: Number(value) } : { [field]: value };
      await updateDoc(doc(db, 'products', product.id, 'designs', designId), updateData);
      setSelectionDesigns(prev => prev.map(d => {
        if (d.id !== designId) return d;
        return isStock ? { ...d, stock: { ...d.stock, [field]: Number(value) } } : { ...d, [field]: value };
      }));
    } catch (err) { showError(err.message); }
  };

  const handleSelectionDesignDelete = async (designId, photoUrl) => {
    if (!window.confirm('Delete this design?')) return;
    try {
      await deleteDoc(doc(db, 'products', product.id, 'designs', designId));
      await deletePhotoFromStorage(photoUrl);
      setSelectionDesigns(prev => prev.filter(d => d.id !== designId));
      showSuccess('Design deleted');
    } catch (err) { showError(err.message); }
  };

  // ── Main photos ───────────────────────────────────────────
  const handleMainPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const newEntries = [];
      for (const file of files) { const url = await uploadPhotoModal(file); newEntries.push({ url, dnNumber: '' }); }
      setInfo(prev => {
        const newUrls = [...(prev.imageUrls || []), ...newEntries];
        const newMain = prev.imageUrl || newEntries[0].url;
        updateDoc(doc(db, 'products', product.id), { imageUrls: newUrls, imageUrl: newMain });
        onSaved({ ...prev, imageUrls: newUrls, imageUrl: newMain }, false);
        return { ...prev, imageUrls: newUrls, imageUrl: newMain };
      });
      showSuccess(`${newEntries.length} photo(s) uploaded`);
    } catch (err) { showError(err.message); }
    setUploadingTab2(false);
  };

  const handleMainPhotoUpdate = async (index, dnNumber) => {
    try {
      setInfo(prev => {
        const newUrls = prev.imageUrls.map((img, i) => i === index ? { ...img, dnNumber } : img);
        updateDoc(doc(db, 'products', product.id), { imageUrls: newUrls });
        onSaved({ ...prev, imageUrls: newUrls }, false);
        return { ...prev, imageUrls: newUrls };
      });
    } catch (err) { showError(err.message); }
  };

  const handleMainPhotoDelete = async (index, url) => {
    if (!window.confirm('Remove photo?')) return;
    try {
      await deletePhotoFromStorage(url);
      setInfo(prev => {
        const newUrls = prev.imageUrls.filter((_, i) => i !== index);
        const newMain = newUrls.length > 0 ? newUrls[0].url : '';
        updateDoc(doc(db, 'products', product.id), { imageUrls: newUrls, imageUrl: newMain });
        onSaved({ ...prev, imageUrls: newUrls, imageUrl: newMain }, false);
        return { ...prev, imageUrls: newUrls, imageUrl: newMain };
      });
      showSuccess('Photo removed');
    } catch (err) { showError(err.message); }
  };

  // ── Fullset stock ─────────────────────────────────────────
  const handleFullsetStockLocalChange = (field, value) => {
    setPendingStock(prev => ({ ...prev, [field]: Number(value) }));
  };

  const handleSaveFullsetStock = async () => {
    setSavingStock(true);
    try {
      await updateDoc(doc(db, 'products', product.id), { fullSetStock: pendingStock });
      setInfo(prev => { const updated = { ...prev, fullSetStock: pendingStock }; onSaved(updated, false); return updated; });
      showSuccess('Stock saved!');
    } catch (err) { showError(err.message); }
    setSavingStock(false);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ backgroundColor: D.bg, borderRadius: 20, width: '94%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(3,22,50,0.25)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: D.navy, padding: '16px 20px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'white' }}>Edit Product</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={handleDeleteProduct} disabled={isDeleting}
              style={{ padding: '6px 14px', backgroundColor: 'rgba(186,26,26,0.2)', color: '#ff8a80', border: '1px solid rgba(186,26,26,0.4)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1 }}>
              {isDeleting ? 'Deleting...' : '🗑 Delete'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, flexShrink: 0 }}>
          {['Basic Info', 'Photos & Stock'].map((label, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: '14px', border: 'none', borderBottom: activeTab === i ? `2px solid ${D.gold}` : '2px solid transparent', backgroundColor: 'transparent', color: activeTab === i ? D.gold : D.textSecondary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>

        {error && <div style={{ backgroundColor: '#fce8e6', color: D.error, padding: '10px 20px', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>⚠ {error}</div>}
        {successMsg && <div style={{ backgroundColor: '#e6f4ea', color: D.success, padding: '10px 20px', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>✓ {successMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* TAB 1 */}
          {activeTab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SectionBox>
                <TextInput label="Product Name" value={info.name || ''} onChange={v => setInfo({ ...info, name: v })} required />
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <div style={{ flex: 1 }}><TextInput label="MOQ" type="number" value={info.moq || ''} onChange={v => setInfo({ ...info, moq: v })} required /></div>
                  <div style={{ flex: 1 }}>
                    <LabelRow label="Unit" required>
                      <select style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent' }} value={info.unit || ''} onChange={e => setInfo({ ...info, unit: e.target.value })}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </LabelRow>
                  </div>
                </div>
                {info.isStitched && <TextInput label="Material" value={info.material || ''} onChange={v => setInfo({ ...info, material: v })} />}
                {info.template === 'running' && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <div style={{ flex: 1 }}><TextInput label='Width (e.g. 44")' value={info.width || ''} onChange={v => setInfo({ ...info, width: v })} /></div>
                    <div style={{ flex: 1 }}><TextInput label="Meters" type="number" value={info.runningMeters || ''} onChange={v => setInfo({ ...info, runningMeters: v })} /></div>
                  </div>
                )}
                {info.isNighty ? (
                  <div style={{ padding: '12px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: D.textSecondary, fontWeight: 700 }}>Rate per Cut</p>
                    {(info.cuts || []).map(cut => (
                      <div key={cut} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, minWidth: 50 }}>{cut}</span>
                        <span style={{ color: D.textSecondary }}>₹</span>
                        <input type="number" value={info.cutRates?.[cut] || ''} onChange={e => setInfo({ ...info, cutRates: { ...info.cutRates, [cut]: Number(e.target.value) } })} style={{ flex: 1, padding: '8px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, outline: 'none' }} placeholder="Rate per set" />
                        <span style={{ fontSize: 12, color: D.textSecondary }}>/set</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <TextInput label="Price (₹)" type="number" value={info.price || ''} onChange={v => setInfo({ ...info, price: v })} required />
                )}
                <div style={{ padding: '12px 0 4px' }}>
                  <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 8 }}>Description</span>
                  <textarea value={info.description || ''} onChange={e => setInfo({ ...info, description: e.target.value })} rows={3} style={{ width: '100%', border: `1px solid ${D.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </SectionBox>
              <button onClick={handleSaveBasicInfo} disabled={isSavingBasic} style={{ width: '100%', padding: '14px', backgroundColor: isSavingBasic ? D.border : D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: isSavingBasic ? 'not-allowed' : 'pointer', marginTop: 10 }}>
                {isSavingBasic ? 'Saving...' : 'Save Basic Info ✓'}
              </button>
            </div>
          )}

          {/* TAB 2 */}
          {activeTab === 1 && (
            <div>
              {loadingTab2 && <p style={{ textAlign: 'center', fontSize: 13, color: D.textSecondary, padding: '40px 0' }}>Loading...</p>}
              {!loadingTab2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Nighty */}
                  {info.designMode === 'nighty' && nightyCuts.map(cut => (
                    <SectionBox key={cut.id} title={`Cut: ${cut.label}${info.cutRates?.[cut.label] ? ` · ₹${info.cutRates[cut.label]}/set` : ''}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        {cut.designs?.map(design => (
                          <div key={design.id} style={{ display: 'flex', gap: 12, backgroundColor: D.surface, padding: 12, borderRadius: 10, border: `1px solid ${D.borderLight}` }}>
                            <img src={design.photoUrl} alt="" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div><span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>Design No</span><span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>#{design.designNo}</span></div>
                              <div><span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>D.No</span><input type="text" value={design.dnNumber || ''} onChange={e => handleNightyDesignUpdate(cut.id, design.id, 'dnNumber', e.target.value)} style={{ width: '100%', padding: '6px 8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="e.g. 1001" /></div>
                              <div><span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>Sets</span><input type="number" min="0" value={design.sets || 0} onChange={e => handleNightyDesignUpdate(cut.id, design.id, 'sets', Number(e.target.value))} style={{ width: '100%', padding: '6px 8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} /></div>
                            </div>
                            <button onClick={() => handleNightyDesignDelete(cut.id, design.id, design.photoUrl)} style={{ alignSelf: 'flex-start', background: '#fce8e6', border: 'none', color: D.error, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>Delete</button>
                          </div>
                        ))}
                      </div>
                      <label style={{ display: 'block', border: `1.5px dashed ${D.border}`, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer', backgroundColor: D.surface }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: D.navy }}>{uploadingTab2 ? 'Uploading...' : `+ Add Designs for ${cut.label}`}</span>
                        <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={e => handleNightyDesignUpload(cut.id, e)} disabled={uploadingTab2} />
                      </label>
                    </SectionBox>
                  ))}

                  {/* Design wise */}
                  {info.designMode === 'design' && (
                    <SectionBox title="Designs & Stock">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                        {selectionDesigns.map(design => (
                          <div key={design.id} style={{ display: 'flex', gap: 12, backgroundColor: D.surface, padding: 14, borderRadius: 10, border: `1px solid ${D.borderLight}` }}>
                            <img src={design.photoUrl} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>Design #{design.designNo}</span>
                              <div style={{ marginTop: 6, marginBottom: 10 }}>
                                <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>D.No</span>
                                <input type="text" value={design.dnNumber || ''} onChange={e => handleSelectionDesignUpdate(design.id, 'dnNumber', e.target.value)} style={{ width: '100%', padding: '8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} placeholder="e.g. 1001" />
                              </div>
                              <span style={{ fontSize: 11, color: D.navy, fontWeight: 700, display: 'block', marginBottom: 6 }}>Stock</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {info.isStitched ? info.sizes?.map(size => (
                                  <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>{size}</span>
                                    <input type="number" min="0" value={design.stock?.[size] || 0} onChange={e => handleSelectionDesignUpdate(design.id, size, e.target.value, true)} style={{ width: 44, padding: '4px', border: `1px solid ${D.border}`, borderRadius: 4, textAlign: 'center', fontSize: 12 }} />
                                  </div>
                                )) : (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>Sets</span>
                                    <input type="number" min="0" value={design.stock?.sets || 0} onChange={e => handleSelectionDesignUpdate(design.id, 'sets', e.target.value, true)} style={{ width: 80, padding: '6px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12 }} />
                                  </div>
                                )}
                              </div>
                            </div>
                            <button onClick={() => handleSelectionDesignDelete(design.id, design.photoUrl)} style={{ alignSelf: 'flex-start', background: '#fce8e6', border: 'none', color: D.error, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>Delete</button>
                          </div>
                        ))}
                      </div>
                      <label style={{ display: 'block', backgroundColor: D.navy, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{uploadingTab2 ? 'Uploading...' : '+ Add Designs'}</span>
                        <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={handleSelectionDesignUpload} disabled={uploadingTab2} />
                      </label>
                    </SectionBox>
                  )}

                  {/* Fullset / Running */}
                  {(info.designMode === 'fullset' || info.designMode === 'running') && (
                    <>
                      <SectionBox title="Photos">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                          {(info.imageUrls || []).map((img, idx) => (
                            <div key={idx} style={{ backgroundColor: D.surface, padding: 8, borderRadius: 8, border: `1px solid ${D.borderLight}` }}>
                              <img src={img.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                              {info.designMode === 'fullset' && <input type="text" placeholder="D.No" value={img.dnNumber || ''} onChange={e => handleMainPhotoUpdate(idx, e.target.value)} style={{ width: '100%', padding: '6px', border: `1px solid ${D.border}`, borderRadius: 4, fontSize: 11, boxSizing: 'border-box', marginBottom: 8 }} />}
                              <button onClick={() => handleMainPhotoDelete(idx, img.url)} style={{ width: '100%', padding: '6px', backgroundColor: '#fce8e6', color: D.error, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                            </div>
                          ))}
                        </div>
                        <label style={{ display: 'block', backgroundColor: D.navy, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{uploadingTab2 ? 'Uploading...' : '+ Upload Photo(s)'}</span>
                          <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={handleMainPhotoUpload} disabled={uploadingTab2} />
                        </label>
                      </SectionBox>
                      {info.designMode === 'fullset' && pendingStock !== null && (
                        <SectionBox title="Overall Stock">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                            {info.isStitched ? info.sizes?.map(size => (
                              <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, marginBottom: 4 }}>{size}</span>
                                <input type="number" min="0" value={pendingStock[size] ?? 0} onChange={e => handleFullsetStockLocalChange(size, e.target.value)} style={{ width: 60, padding: '8px', border: `1px solid ${D.border}`, borderRadius: 6, textAlign: 'center', fontSize: 14, fontWeight: 700 }} />
                              </div>
                            )) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input type="number" min="0" value={pendingStock.sets ?? 0} onChange={e => handleFullsetStockLocalChange('sets', e.target.value)} style={{ width: 120, padding: '10px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 16, fontWeight: 700, color: D.navy, outline: 'none' }} />
                                <span style={{ fontSize: 14, color: D.textSecondary }}>Total Sets</span>
                              </div>
                            )}
                          </div>
                          <button onClick={handleSaveFullsetStock} disabled={savingStock} style={{ width: '100%', padding: '12px', backgroundColor: savingStock ? D.border : D.success, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: savingStock ? 'not-allowed' : 'pointer' }}>
                            {savingStock ? 'Saving Stock...' : 'Save Stock ✓'}
                          </button>
                        </SectionBox>
                      )}
                    </>
                  )}

                  {uploadingTab2 && <p style={{ textAlign: 'center', fontSize: 12, color: D.warning, padding: '8px 0' }}>⏳ Processing upload...</p>}
                  <p style={{ textAlign: 'center', fontSize: 11, color: D.textSecondary, fontStyle: 'italic', marginTop: 4 }}>* Design changes (add/delete/edit) are saved immediately.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditProductModal;