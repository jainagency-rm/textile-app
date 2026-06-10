import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { SIZES, UNITS, NIGHTY_CATEGORIES, STITCHED_CATEGORIES, CHUDIDAR_CATEGORY } from '../../constants/product';

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
      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 100, flexShrink: 0 }}>
        {label}{required && <span style={{ color: D.error }}>*</span>}
      </span>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text', placeholder, required, min }) {
  return (
    <LabelRow label={label} required={required}>
      <input type={type} value={value} min={min} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''}
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }} />
    </LabelRow>
  );
}

export default function EditProductModal({ product, categories = [], onClose, onSaved, onDeleted }) {
  const [activeTab, setActiveTab] = useState(0);

  // 🌟 Auto Fetch Categories if Parent forgot to pass them
  const [localCategories, setLocalCategories] = useState(categories);
  useEffect(() => {
    if (categories.length === 0) {
      const fetchCats = async () => {
        try {
          const snap = await getDocs(collection(db, 'categories'));
          setLocalCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) { console.error("Categories fetch fail", e); }
      };
      fetchCats();
    } else {
      setLocalCategories(categories);
    }
  }, [categories]);

  const [info, setInfo] = useState(() => {
    let mode = product.designMode;
    if (!mode) {
      if (NIGHTY_CATEGORIES.includes(product.category) || product.isNighty) mode = 'nighty';
      else if (product.template === 'running') mode = 'running';
      else mode = 'fullset';
    }
    let urls = product.imageUrls || [];
    urls = urls.map(img => typeof img === 'string' ? { url: img, dnNumber: '' } : img);
    if (urls.length === 0 && product.imageUrl) urls = [{ url: product.imageUrl, dnNumber: '' }];
    
    // 🌟 Load old units or default fallback
    const pu = product.priceUnit || product.unit || 'Piece';
    const mu = product.moqUnit || product.unit || 'Piece';

    return { ...product, designMode: mode, imageUrls: urls, priceUnit: pu, moqUnit: mu };
  });

  const isNightyCat    = NIGHTY_CATEGORIES.includes(info.category) || info.isNighty;
  const isStitchedCat  = STITCHED_CATEGORIES.includes(info.category) || info.isStitched;
  const isChudidar     = info.category === CHUDIDAR_CATEGORY;

  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [error, setError]                 = useState(null);
  const [successMsg, setSuccessMsg]       = useState(null);
  const [loadingTab2, setLoadingTab2]     = useState(false);
  const [nightyCuts, setNightyCuts]       = useState([]);
  const [selectionDesigns, setSelectionDesigns] = useState([]);
  const [uploadingTab2, setUploadingTab2] = useState(false);
  const [dragPhoto, setDragPhoto] = useState({ ctx: null, idx: null });

  const reorderArr = (arr, from, to) => {
    const a = [...arr]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return a;
  };
  const dragProps = (ctx, idx, getArr, setArr) => ({
    draggable: true,
    onDragStart: () => setDragPhoto({ ctx, idx }),
    onDragOver: e => e.preventDefault(),
    onDragEnter: () => {
      if (dragPhoto.ctx !== ctx || dragPhoto.idx === idx) return;
      setArr(reorderArr(getArr(), dragPhoto.idx, idx));
      setDragPhoto({ ctx, idx });
    },
    onDragEnd: () => setDragPhoto({ ctx: null, idx: null }),
  });
  const [savingStock, setSavingStock]     = useState(false);
  const [pendingStock, setPendingStock]   = useState(() => product.fullSetStock || {});

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 2500); };
  const showError   = (msg) => { setError(msg);      setTimeout(() => setError(null), 3000); };

  const loadTab2Data = useCallback(async () => {
    setLoadingTab2(true);
    try {
      if (info.designMode === 'nighty') {
        const cutsSnap = await getDocs(collection(db, 'products', product.id, 'cuts'));
        const cutsData = await Promise.all(cutsSnap.docs.map(async (cutDoc) => {
          const designsSnap = await getDocs(collection(db, 'products', product.id, 'cuts', cutDoc.id, 'designs'));
          return { id: cutDoc.id, ...cutDoc.data(), designs: designsSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
        }));
        setNightyCuts(cutsData);
      } else if (info.designMode === 'design') {
        const designsSnap = await getDocs(collection(db, 'products', product.id, 'designs'));
        setSelectionDesigns(designsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) { showError('Failed to load: ' + err.message); }
    setLoadingTab2(false);
  }, [info.designMode, product.id]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    setError(null);
    if (activeTab === 1) loadTab2Data();
  }, [activeTab, loadTab2Data]);

  const uploadPhoto = async (file) => {
    const userId = auth.currentUser?.uid || 'unknown';
    const fileRef = ref(storage, `designs/${userId}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const deleteFromStorage = async (url) => {
    if (!url) return;
    try { await deleteObject(ref(storage, url)); } catch (_) {}
  };

  const toggleSize = (size) => {
    const curr = info.sizes || [];
    setInfo({ ...info, sizes: curr.includes(size) ? curr.filter(s => s !== size) : [...curr, size] });
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDeleteProduct = async () => {
    if (!window.confirm(`"${product.name}" permanently delete karna chahte ho?\n\nYeh undo nahi hoga.`)) return;
    setIsDeleting(true);
    try {
      if (info.designMode === 'nighty') {
        const cutsSnap = await getDocs(collection(db, 'products', product.id, 'cuts'));
        for (const cutDoc of cutsSnap.docs) {
          const dSnap = await getDocs(collection(db, 'products', product.id, 'cuts', cutDoc.id, 'designs'));
          for (const d of dSnap.docs) { await deleteFromStorage(d.data().photoUrl); await deleteDoc(d.ref); }
          await deleteDoc(cutDoc.ref);
        }
      } else if (info.designMode === 'design') {
        const dSnap = await getDocs(collection(db, 'products', product.id, 'designs'));
        for (const d of dSnap.docs) { await deleteFromStorage(d.data().photoUrl); await deleteDoc(d.ref); }
      }
      for (const img of (info.imageUrls || [])) { await deleteFromStorage(typeof img === 'string' ? img : img.url); }
      if (info.imageUrl && !info.imageUrls?.length) await deleteFromStorage(info.imageUrl);
      await deleteDoc(doc(db, 'products', product.id));
      if (onDeleted) onDeleted(product.id);
    } catch (err) { showError('Delete failed: ' + err.message); setIsDeleting(false); }
  };

  // ── Save Basic Info ───────────────────────────────────────
  const handleSaveBasicInfo = async () => {
    setIsSavingBasic(true); setError(null);
    try {
      const payload = {
        name:        info.name,
        category:    info.category || '',
        moq:         Number(info.moq) || 0,
        priceUnit:   info.priceUnit, // 🌟 Save both units
        moqUnit:     info.moqUnit,
        pcsPerSet: (info.moqUnit === 'Set') ? (Number(info.pcsPerSet) || null) : null,
        description: info.description || '',
      };

      if (isNightyCat) {
        payload.cutRates = info.cutRates || {};
        const firstRate = Object.values(info.cutRates || {})[0];
        if (firstRate) payload.price = Number(firstRate);
      } else {
        payload.price = Number(info.price) || 0;
      }

      if (isChudidar) {
        payload.chudidarTopMaterial     = info.chudidarTopMaterial || '';
        payload.chudidarBottomMaterial  = info.chudidarBottomMaterial || '';
        payload.chudidarDupattaMaterial = info.chudidarDupattaMaterial || '';
      } else if (isStitchedCat) {
        payload.material = info.material || '';
        payload.sizes    = info.sizes || [];
      }

      if (info.template === 'running') {
        payload.width         = info.width || '';
        payload.runningMeters = Number(info.runningMeters) || 0;
      }

      await updateDoc(doc(db, 'products', product.id), payload);
      const updated = { ...info, ...payload };
      setInfo(updated);
      onSaved(updated, false);
      showSuccess('Saved!');
    } catch (err) { showError('Save failed: ' + err.message); }
    setIsSavingBasic(false);
  };

  // ── Nighty design handlers ────────────────────────────────
  const handleNightyDesignUpload = async (cutId, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const cut = nightyCuts.find(c => c.id === cutId);
      const base = cut?.designs?.length || 0;
      const newDesigns = await Promise.all(files.map(async (file, i) => {
        const url = await uploadPhoto(file);
        const nd = { designNo: base + i + 1, dnNumber: '', sets: 0, photoUrl: url, addedAt: new Date() };
        const ref_ = await addDoc(collection(db, 'products', product.id, 'cuts', cutId, 'designs'), nd);
        return { id: ref_.id, ...nd };
      }));
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
      await deleteFromStorage(photoUrl);
      setNightyCuts(prev => prev.map(c => c.id === cutId ? { ...c, designs: c.designs.filter(d => d.id !== designId) } : c));
      showSuccess('Design deleted');
    } catch (err) { showError(err.message); }
  };

  // ── Selection design handlers ─────────────────────────────
  const handleSelectionDesignUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const base = selectionDesigns.length;
      const newDesigns = await Promise.all(files.map(async (file, i) => {
        const url = await uploadPhoto(file);
        const defaultStock = isStitchedCat
          ? (info.sizes || []).reduce((acc, s) => ({ ...acc, [s]: 0 }), {})
          : { sets: 0 };
        const nd = { designNo: base + i + 1, dnNumber: '', stock: defaultStock, photoUrl: url, addedAt: new Date() };
        const ref_ = await addDoc(collection(db, 'products', product.id, 'designs'), nd);
        return { id: ref_.id, ...nd };
      }));
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
      await deleteFromStorage(photoUrl);
      setSelectionDesigns(prev => prev.filter(d => d.id !== designId));
      showSuccess('Design deleted');
    } catch (err) { showError(err.message); }
  };

  // ── Main photo handlers ───────────────────────────────────
  const handleMainPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const urls = await Promise.all(files.map(uploadPhoto));
      const newEntries = urls.map(url => ({ url, dnNumber: '' }));
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

  const handleMainPhotoUpdate = (index, dnNumber) => {
    setInfo(prev => {
      const newUrls = prev.imageUrls.map((img, i) => i === index ? { ...img, dnNumber } : img);
      updateDoc(doc(db, 'products', product.id), { imageUrls: newUrls });
      onSaved({ ...prev, imageUrls: newUrls }, false);
      return { ...prev, imageUrls: newUrls };
    });
  };

  const handleMainPhotoDelete = async (index, url) => {
    if (!window.confirm('Remove photo?')) return;
    try {
      await deleteFromStorage(url);
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

  const handleFullsetStockChange = (field, value) => setPendingStock(prev => ({ ...prev, [field]: Number(value) }));

  const handleSaveFullsetStock = async () => {
    setSavingStock(true);
    try {
      await updateDoc(doc(db, 'products', product.id), { fullSetStock: pendingStock });
      setInfo(prev => { const u = { ...prev, fullSetStock: pendingStock }; onSaved(u, false); return u; });
      showSuccess('Stock saved!');
    } catch (err) { showError(err.message); }
    setSavingStock(false);
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

        {error      && <div style={{ backgroundColor: '#fce8e6', color: D.error,   padding: '10px 20px', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>⚠ {error}</div>}
        {successMsg && <div style={{ backgroundColor: '#e6f4ea', color: D.success, padding: '10px 20px', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>✓ {successMsg}</div>}

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ═══ TAB 1: Basic Info ═══ */}
          {activeTab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SectionBox>
                {/* Name */}
                <TextInput label="Product Name" value={info.name || ''} onChange={v => setInfo({ ...info, name: v })} required />

                {/* 🌟 Auto Loaded Category */}
                <LabelRow label="Category" required>
                  <select style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: D.textPrimary, backgroundColor: 'transparent' }}
                    value={info.category || ''} onChange={e => setInfo({ ...info, category: e.target.value })}>
                    <option value="" disabled>Select Category</option>
                    {localCategories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </LabelRow>

                {/* 🌟 Separate MOQ row with Unit Dropdown */}
                <LabelRow label="MOQ" required>
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8 }}>
                    <input type="number" min="1" value={info.moq || ''} onChange={e => setInfo({ ...info, moq: e.target.value })} placeholder="Min order qty" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }} />
                    <select style={{ border: 'none', outline: 'none', fontSize: 16, color: D.navy, fontWeight: 700, backgroundColor: 'transparent', cursor: 'pointer' }}
                      value={info.moqUnit || 'Piece'} onChange={e => setInfo({ ...info, moqUnit: e.target.value })}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </LabelRow>

                {/* ✅ pcsPerSet — sirf jab moqUnit === 'Set' */}
                  {(info.moqUnit === 'Set') && (
                    <LabelRow label="Pcs / Set" required>
                      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8 }}>
                        <input
                          type="number" min="1"
                          value={info.pcsPerSet || ''}
                          onChange={e => setInfo({ ...info, pcsPerSet: e.target.value })}
                          placeholder="e.g. 6"
                          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16,
                            color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }}
                        />
                        <span style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}>
                          Pieces per Set
                        </span>
                      </div>
                    </LabelRow>
)}

                {/* Price / Cut rates based on Category type */}
                {isNightyCat ? (
                  <div style={{ padding: '12px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <p style={{ margin: '0 0 10px', fontSize: 13, color: D.textSecondary, fontWeight: 700 }}>Rate per Cut</p>
                      {/* Price Unit Selector for Nighty */}
                      <select value={info.priceUnit || 'Piece'} onChange={e => setInfo({ ...info, priceUnit: e.target.value })} style={{ border: 'none', outline: 'none', fontSize: 16, color: D.navy, fontWeight: 700, backgroundColor: 'transparent', cursor: 'pointer' }}>
                        {UNITS.map(u => <option key={u} value={u}>Per {u}</option>)}
                      </select>
                    </div>
                    {(info.cuts || []).map(cut => (
                      <div key={cut} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, minWidth: 50 }}>{cut}</span>
                        <span style={{ color: D.textSecondary }}>₹</span>
                        <input type="number" min="0" value={info.cutRates?.[cut] || ''}
                          onChange={e => setInfo({ ...info, cutRates: { ...info.cutRates, [cut]: Number(e.target.value) } })}
                          style={{ flex: 1, padding: '8px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 16, outline: 'none' }} placeholder="Rate" />
                        <span style={{ fontSize: 12, color: D.textSecondary }}>/{info.priceUnit || 'Piece'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <LabelRow label="Price (₹)" required>
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8 }}>
                      <input type="number" min="0" value={info.price || ''} onChange={e => setInfo({ ...info, price: e.target.value })} placeholder="Price" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }} />
                      <select style={{ border: 'none', outline: 'none', fontSize: 16, color: D.navy, fontWeight: 700, backgroundColor: 'transparent', cursor: 'pointer' }}
                        value={info.priceUnit || 'Piece'} onChange={e => setInfo({ ...info, priceUnit: e.target.value })}>
                        {UNITS.map(u => <option key={u} value={u}>Per {u}</option>)}
                      </select>
                    </div>
                  </LabelRow>
                )}

                {/* Material — Chudidar: 3 fields, others: 1 field */}
                {isChudidar ? (
                  <>
                    <TextInput label="Top Material"     value={info.chudidarTopMaterial || ''}     onChange={v => setInfo({ ...info, chudidarTopMaterial: v })}     placeholder="e.g. Cotton" />
                    <TextInput label="Bottom Material"  value={info.chudidarBottomMaterial || ''}  onChange={v => setInfo({ ...info, chudidarBottomMaterial: v })}  placeholder="e.g. Cotton" />
                    <TextInput label="Dupatta Material" value={info.chudidarDupattaMaterial || ''} onChange={v => setInfo({ ...info, chudidarDupattaMaterial: v })} placeholder="e.g. Georgette" />
                  </>
                ) : isStitchedCat ? (
                  <TextInput label="Material" value={info.material || ''} onChange={v => setInfo({ ...info, material: v })} placeholder="e.g. Rayon, Cotton" />
                ) : null}

                {/* Sizes — stitched only */}
                {isStitchedCat && (
                  <div style={{ padding: '12px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: D.textSecondary, fontWeight: 700 }}>Sizes</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {SIZES.map(size => {
                        const active = (info.sizes || []).includes(size);
                        return (
                          <button key={size} type="button" onClick={() => toggleSize(size)}
                            style={{ padding: '6px 14px', borderRadius: 8, border: `2px solid ${active ? D.navy : D.border}`, backgroundColor: active ? D.navy : D.surface, color: active ? 'white' : D.textPrimary, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer' }}>
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Running fields */}
                {info.template === 'running' && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <div style={{ flex: 1 }}><TextInput label="Width" value={info.width || ''} onChange={v => setInfo({ ...info, width: v })} placeholder='e.g. 44"' /></div>
                    <div style={{ flex: 1 }}><TextInput label="Meters" type="number" min="0" value={info.runningMeters || ''} onChange={v => setInfo({ ...info, runningMeters: v })} /></div>
                  </div>
                )}

                {/* Description */}
                <div style={{ padding: '12px 0 4px' }}>
                  <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 8 }}>Description</span>
                  <textarea value={info.description || ''} onChange={e => setInfo({ ...info, description: e.target.value })} rows={3}
                    style={{ width: '100%', border: `1px solid ${D.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 16, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </SectionBox>

              <button onClick={handleSaveBasicInfo} disabled={isSavingBasic}
                style={{ width: '100%', padding: '14px', backgroundColor: isSavingBasic ? D.border : D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: isSavingBasic ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                {isSavingBasic ? 'Saving...' : 'Save Basic Info ✓'}
              </button>
            </div>
          )}

          {/* ═══ TAB 2: Photos & Stock ═══ */}
          {activeTab === 1 && (
            <div>
              {loadingTab2 && <p style={{ textAlign: 'center', fontSize: 13, color: D.textSecondary, padding: '40px 0' }}>Loading...</p>}
              {!loadingTab2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* NIGHTY */}
                  {info.designMode === 'nighty' && nightyCuts.map(cut => (
                    <SectionBox key={cut.id} title={`Cut: ${cut.label}${info.cutRates?.[cut.label] ? ` · ₹${info.cutRates[cut.label]}/${info.priceUnit || 'Piece'}` : ''}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        {cut.designs?.map((design, dIdx) => (
                          <div key={design.id}
                            {...dragProps(`cut_${cut.id}`, dIdx, () => nightyCuts.find(c => c.id === cut.id)?.designs || [], (arr) => setNightyCuts(prev => prev.map(c => c.id === cut.id ? { ...c, designs: arr } : c)))}
                            style={{ display: 'flex', gap: 12, backgroundColor: D.surface, padding: 12, borderRadius: 10, border: `1px solid ${D.borderLight}`, cursor: 'grab', opacity: dragPhoto.ctx === `cut_${cut.id}` && dragPhoto.idx === dIdx ? 0.4 : 1 }}>
                            <img src={design.photoUrl} alt="" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div><span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>Design No</span><span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>#{design.designNo}</span></div>
                              <div><span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>D.No</span>
                                <input type="text" className="grid-input" onFocus={e => e.target.select()} value={design.dnNumber || ''} onChange={e => handleNightyDesignUpdate(cut.id, design.id, 'dnNumber', e.target.value)}
                                  style={{ width: '100%', padding: '6px 8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 16, boxSizing: 'border-box' }} placeholder="e.g. 1001" /></div>
                              <div><span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>Sets</span>
                                <input type="number" min="0" className="grid-input" onFocus={e => e.target.select()} value={design.sets !== undefined ? design.sets : ''} onChange={e => handleNightyDesignUpdate(cut.id, design.id, 'sets', e.target.value === '' ? '' : Number(e.target.value))}
                                  style={{ width: '100%', padding: '6px 8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 16, boxSizing: 'border-box' }} placeholder="0" /></div>
                            </div>
                            <button onClick={() => handleNightyDesignDelete(cut.id, design.id, design.photoUrl)}
                              style={{ alignSelf: 'flex-start', background: '#fce8e6', border: 'none', color: D.error, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>Delete</button>
                          </div>
                        ))}
                      </div>
                      <label style={{ display: 'block', border: `1.5px dashed ${D.border}`, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer', backgroundColor: D.surface }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: D.navy }}>{uploadingTab2 ? 'Uploading...' : `+ Add Designs for ${cut.label}`}</span>
                        <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={e => handleNightyDesignUpload(cut.id, e)} disabled={uploadingTab2} />
                      </label>
                    </SectionBox>
                  ))}

                  {/* DESIGN WISE */}
                  {info.designMode === 'design' && (
                    <SectionBox title="Designs & Stock">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                        {selectionDesigns.map((design, dIdx) => (
                          <div key={design.id}
                            {...dragProps('selection', dIdx, () => selectionDesigns, setSelectionDesigns)}
                            style={{ display: 'flex', gap: 12, backgroundColor: D.surface, padding: 14, borderRadius: 10, border: `1px solid ${D.borderLight}`, cursor: 'grab', opacity: dragPhoto.ctx === 'selection' && dragPhoto.idx === dIdx ? 0.4 : 1 }}>
                            <img src={design.photoUrl} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>Design #{design.designNo}</span>
                              <div style={{ marginTop: 6, marginBottom: 10 }}>
                                <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>D.No</span>
                                <input type="text" className="grid-input" onFocus={e => e.target.select()} value={design.dnNumber || ''} onChange={e => handleSelectionDesignUpdate(design.id, 'dnNumber', e.target.value)}
                                  style={{ width: '100%', padding: '8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 16, boxSizing: 'border-box' }} placeholder="e.g. 1001" />
                              </div>
                              <span style={{ fontSize: 11, color: D.navy, fontWeight: 700, display: 'block', marginBottom: 6 }}>Stock</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {isStitchedCat ? (info.sizes || []).map(size => (
                                  <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>{size}</span>
                                    <input type="number" min="0" className="grid-input" onFocus={e => e.target.select()} value={design.stock?.[size] !== undefined ? design.stock[size] : ''} onChange={e => handleSelectionDesignUpdate(design.id, size, e.target.value === '' ? '' : Number(e.target.value), true)}
                                      style={{ width: 44, padding: '4px', border: `1px solid ${D.border}`, borderRadius: 4, textAlign: 'center', fontSize: 16 }} placeholder="0" />
                                  </div>
                                )) : (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>Sets</span>
                                    <input type="number" min="0" className="grid-input" onFocus={e => e.target.select()} value={design.stock?.sets !== undefined ? design.stock.sets : ''} onChange={e => handleSelectionDesignUpdate(design.id, 'sets', e.target.value === '' ? '' : Number(e.target.value), true)}
                                      style={{ width: 80, padding: '6px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 16 }} placeholder="0" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <button onClick={() => handleSelectionDesignDelete(design.id, design.photoUrl)}
                              style={{ alignSelf: 'flex-start', background: '#fce8e6', border: 'none', color: D.error, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>Delete</button>
                          </div>
                        ))}
                      </div>
                      <label style={{ display: 'block', backgroundColor: D.navy, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{uploadingTab2 ? 'Uploading...' : '+ Add Designs'}</span>
                        <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={handleSelectionDesignUpload} disabled={uploadingTab2} />
                      </label>
                    </SectionBox>
                  )}

                  {/* FULLSET / RUNNING */}
                  {(info.designMode === 'fullset' || info.designMode === 'running') && (
                    <>
                      <SectionBox title="Photos">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                          {(info.imageUrls || []).map((img, idx) => (
                            <div key={idx}
                              {...dragProps('imageUrls', idx, () => info.imageUrls, (arr) => {
                                const newMain = arr[0]?.url || '';
                                setInfo(prev => ({ ...prev, imageUrls: arr, imageUrl: newMain }));
                                updateDoc(doc(db, 'products', product.id), { imageUrls: arr, imageUrl: newMain });
                              })}
                              style={{ backgroundColor: D.surface, padding: 8, borderRadius: 8, border: `1px solid ${D.borderLight}`, cursor: 'grab', opacity: dragPhoto.ctx === 'imageUrls' && dragPhoto.idx === idx ? 0.4 : 1 }}>
                              <img src={img.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                              {info.designMode === 'fullset' && (
                                <input type="text" className="grid-input" onFocus={e => e.target.select()} placeholder="D.No" value={img.dnNumber || ''} onChange={e => handleMainPhotoUpdate(idx, e.target.value)}
                                  style={{ width: '100%', padding: '6px', border: `1px solid ${D.border}`, borderRadius: 4, fontSize: 16, boxSizing: 'border-box', marginBottom: 8 }} />
                              )}
                              <button onClick={() => handleMainPhotoDelete(idx, img.url)}
                                style={{ width: '100%', padding: '6px', backgroundColor: '#fce8e6', color: D.error, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
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
                            {isStitchedCat ? (info.sizes || []).map(size => (
                              <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, marginBottom: 4 }}>{size}</span>
                                <input type="number" min="0" className="grid-input" onFocus={e => e.target.select()} value={pendingStock[size] !== undefined ? pendingStock[size] : ''} onChange={e => handleFullsetStockChange(size, e.target.value === '' ? '' : Number(e.target.value))}
                                  style={{ width: 60, padding: '8px', border: `1px solid ${D.border}`, borderRadius: 6, textAlign: 'center', fontSize: 16, fontWeight: 700 }} placeholder="0" />
                              </div>
                            )) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input type="number" min="0" className="grid-input" onFocus={e => e.target.select()} value={pendingStock.sets !== undefined ? pendingStock.sets : ''} onChange={e => handleFullsetStockChange('sets', e.target.value === '' ? '' : Number(e.target.value))}
                                  style={{ width: 120, padding: '10px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 16, fontWeight: 700, color: D.navy, outline: 'none' }} placeholder="0" />
                                <span style={{ fontSize: 14, color: D.textSecondary }}>Total Sets</span>
                              </div>
                            )}
                          </div>
                          <button onClick={handleSaveFullsetStock} disabled={savingStock}
                            style={{ width: '100%', padding: '12px', backgroundColor: savingStock ? D.border : D.success, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: savingStock ? 'not-allowed' : 'pointer' }}>
                            {savingStock ? 'Saving...' : 'Save Stock ✓'}
                          </button>
                        </SectionBox>
                      )}
                    </>
                  )}

                  {uploadingTab2 && <p style={{ textAlign: 'center', fontSize: 12, color: D.warning, padding: '8px 0' }}>⏳ Uploading...</p>}
                  <p style={{ textAlign: 'center', fontSize: 11, color: D.textSecondary, fontStyle: 'italic', marginTop: 4 }}>* Design changes are saved immediately.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}