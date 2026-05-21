import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { notifyNewProduct } from '../../utils/notifications';

const STITCHED_CATEGORIES = ['Kurti', 'Co-ord Set'];
const CHUDIDAR_CATEGORY = '3pc Chudidar';
const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];
const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const CUT_OPTIONS = ['2/70', '2/90', '3/20'];

const D = {
  navy: '#031632', navyMid: '#1a2b48', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d',
  textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9',
  error: '#ba1a1a', success: '#1a6b3c', warning: '#7a5200',
};

// ── Logout Button (small power icon) ──────────────────────
function LogoutBtn({ onLogout }) {
  return (
    <button onClick={onLogout} title="Logout" style={{
      width: 36, height: 36, borderRadius: 10, border: `1px solid ${D.borderLight}`,
      backgroundColor: D.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.error} strokeWidth="2.5">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
        <line x1="12" y1="2" x2="12" y2="12"/>
      </svg>
    </button>
  );
}

// ── Inline label+input row ─────────────────────────────────
function LabelInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <input
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || `Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}

// ── Add Product Wizard ──────────────────────────────────────
function AddProductWizard({ categories, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [form, setForm] = useState({
    name: '', category: '', price: '', moq: '', unit: 'sets', description: '',
    cut: '', cutValue: '', sizes: [], material: '', productType: '',
    chudidarTop: '', chudidarBottom: '', chudidarDupatta: '',
    chudidarTopMaterial: '', chudidarBottomMaterial: '', chudidarDupattaMaterial: '',
    photos: [],
  });

  const pcsPerSet = form.category === 'Nighty with Dupatta' ? 20 : 30;
  const totalSets = form.photos.reduce((sum, p) => sum + p.sets, 0);
  const isNighty = NIGHTY_CATEGORIES.includes(form.category);
  const isStitched = STITCHED_CATEGORIES.includes(form.category);
  const isChudidar = form.category === CHUDIDAR_CATEGORY;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handlePhotoUpload = async (files) => {
    setUploading(true);
    const user = auth.currentUser;
    const newPhotos = [];
    for (const file of Array.from(files).slice(0, 20)) {
      const imageRef = ref(storage, `designs/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      newPhotos.push({ url, sets: 1, dnNumber: '' });
    }
    setForm(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
    setUploading(false);
  };

  const toggleSize = (size) => {
    const cur = form.sizes;
    setForm({ ...form, sizes: cur.includes(size) ? cur.filter(s => s !== size) : [...cur, size] });
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    await addDoc(collection(db, 'categories'), { name: newCategory.trim() });
    setNewCategory(''); setAddingCategory(false);
    onDone(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const profile = userSnap.data();
      const productData = {
        name: form.name, category: form.category, price: Number(form.price),
        moq: Number(form.moq), unit: form.unit, description: form.description,
        supplierId: user.uid, supplierFirm: profile?.firmName || '',
        status: 'pending', createdAt: new Date(),
        totalSets: isNighty ? totalSets : 0,
        imageUrl: form.photos[0]?.url || '',
        imageUrls: form.photos.map(p => ({ url: p.url, dnNumber: p.dnNumber || '' })),
      };
      if (isNighty) { productData.cut = form.cut; productData.cutValue = form.cutValue; }
      if (isStitched) { productData.sizes = form.sizes; productData.material = form.material; }
      if (isChudidar) {
        productData.productType = form.productType;
        productData.chudidarTop = form.chudidarTop;
        productData.chudidarBottom = form.chudidarBottom;
        productData.chudidarDupatta = form.chudidarDupatta;
        productData.chudidarTopMaterial = form.chudidarTopMaterial;
        productData.chudidarBottomMaterial = form.chudidarBottomMaterial;
        productData.chudidarDupattaMaterial = form.chudidarDupattaMaterial;
        if (form.productType === 'stitched') productData.sizes = form.sizes;
      }
      const productRef = await addDoc(collection(db, 'products'), productData);
      if (isNighty) {
        for (let i = 0; i < form.photos.length; i++) {
          await addDoc(collection(db, 'products', productRef.id, 'designs'), {
            designNo: i + 1, dnNumber: form.photos[i].dnNumber || '',
            sets: form.photos[i].sets, photoUrl: form.photos[i].url, addedAt: new Date(),
          });
        }
      }
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminId = adminSnap.docs[0]?.id;
      if (adminId) await notifyNewProduct(adminId, form.name, profile?.firmName || '');
      onDone(false);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const canNext1 = form.category &&
    (!isNighty || form.cut) &&
    (!isStitched || (form.sizes.length > 0 && form.material)) &&
    (!isChudidar || form.productType);

  const canSubmit = form.name && form.price && form.moq;

  return (
    <div style={W.overlay} onClick={onCancel}>
      <div style={W.sheet} onClick={e => e.stopPropagation()}>
        <div style={W.handle} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button style={W.backBtn} onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, color: D.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Step {step} of 3</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.navy }}>
              {step === 1 ? 'Category & Details' : step === 2 ? 'Photos & Designs' : 'Basic Info'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ width: s <= step ? 20 : 8, height: 6, borderRadius: 3, backgroundColor: s <= step ? D.navy : D.border, transition: 'all 0.2s' }} />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <div style={W.section}>
                <label style={W.label}>Category *</label>
                <select style={W.input} value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value, cut: '', cutValue: '', sizes: [], material: '', productType: '', photos: [] })} required>
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
                {!addingCategory ? (
                  <button type="button" style={W.addCatBtn} onClick={() => setAddingCategory(true)}>+ New Category</button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input style={{ ...W.input, flex: 1, marginBottom: 0 }} placeholder="Category name" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                    <button type="button" style={{ ...W.tagActive, fontSize: 12, padding: '8px 12px' }} onClick={handleAddCategory}>Save</button>
                    <button type="button" style={{ ...W.tag, fontSize: 12, padding: '8px 12px' }} onClick={() => setAddingCategory(false)}>Cancel</button>
                  </div>
                )}
              </div>

              {isNighty && (
                <div style={W.section}>
                  <label style={W.label}>Cut *</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {CUT_OPTIONS.map(cut => (
                      <button key={cut} type="button"
                        style={(form.cut || '').split(',').map(c=>c.trim()).includes(cut) ? W.tagActive : W.tag}
                        onClick={() => {
                          const selected = (form.cut || '').split(',').map(c=>c.trim()).filter(Boolean);
                          const updated = selected.includes(cut) ? selected.filter(c => c !== cut) : [...selected, cut];
                          setForm({ ...form, cut: updated.join(', ') });
                        }}>{cut}</button>
                    ))}
                  </div>
                  {/* Cut inline with value */}
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: D.textSecondary }}>1 set = 5 colours × {pcsPerSet / 5} pcs = {pcsPerSet} pcs</p>
                </div>
              )}

              {isStitched && (
                <div style={W.section}>
                  <label style={W.label}>Available Sizes *</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {SIZES.map(size => (
                      <button key={size} type="button" style={form.sizes.includes(size) ? W.tagActive : W.tag}
                        onClick={() => toggleSize(size)}>{size}</button>
                    ))}
                  </div>
                  <LabelInput label="Material" value={form.material} onChange={v => setForm({ ...form, material: v })} placeholder="e.g. Cotton, Rayon" />
                </div>
              )}

              {isChudidar && (
                <div style={W.section}>
                  <label style={W.label}>Product Type *</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {['stitched', 'unstitched'].map(t => (
                      <button key={t} type="button" style={form.productType === t ? W.tagActive : W.tag}
                        onClick={() => setForm({ ...form, productType: t, sizes: [] })}>{t}</button>
                    ))}
                  </div>
                  {form.productType === 'stitched' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      {SIZES.map(size => (
                        <button key={size} type="button" style={form.sizes.includes(size) ? W.tagActive : W.tag}
                          onClick={() => toggleSize(size)}>{size}</button>
                      ))}
                    </div>
                  )}
                  {form.productType === 'unstitched' && (
                    <>
                      <LabelInput label="Top" value={form.chudidarTop} onChange={v => setForm({ ...form, chudidarTop: v })} placeholder="measurement" />
                      <LabelInput label="Bottom" value={form.chudidarBottom} onChange={v => setForm({ ...form, chudidarBottom: v })} placeholder="measurement" />
                      <LabelInput label="Dupatta" value={form.chudidarDupatta} onChange={v => setForm({ ...form, chudidarDupatta: v })} placeholder="measurement" />
                    </>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <LabelInput label="Top Mat." value={form.chudidarTopMaterial} onChange={v => setForm({ ...form, chudidarTopMaterial: v })} placeholder="material" />
                    <LabelInput label="Bot. Mat." value={form.chudidarBottomMaterial} onChange={v => setForm({ ...form, chudidarBottomMaterial: v })} placeholder="material" />
                    <LabelInput label="Dup. Mat." value={form.chudidarDupattaMaterial} onChange={v => setForm({ ...form, chudidarDupattaMaterial: v })} placeholder="material" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <div style={W.section}>
                <label style={W.label}>{isNighty ? 'Design Photos *' : 'Product Photos'}</label>
                <label style={W.uploadArea}>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => handlePhotoUpload(e.target.files)} />
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ margin: '8px 0 4px', fontSize: 14, fontWeight: 600, color: D.navy }}>Tap to upload photos</p>
                  <p style={{ margin: 0, fontSize: 12, color: D.textSecondary }}>Max 20 photos</p>
                </label>
                {uploading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '10px 14px', backgroundColor: '#fef7e0', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: D.warning, fontWeight: 600 }}>⏳ Uploading...</span>
                  </div>
                )}
              </div>

              {isNighty && form.photos.length > 0 && (
                <div style={W.section}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={W.sectionTitle}>Designs ({form.photos.length})</p>
                    <div style={{ backgroundColor: D.navy, borderRadius: 20, padding: '4px 12px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{totalSets} sets · {totalSets * pcsPerSet} pcs</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {form.photos.map((photo, index) => (
                      <div key={index} style={W.designCard}>
                        <img src={photo.url} alt="" style={W.designImg} />
                        <p style={{ margin: '6px 0 4px', fontSize: 11, fontWeight: 700, color: D.navy }}>DN {index + 1}</p>
                        <input type="text" placeholder="DN No." value={photo.dnNumber || ''}
                          onChange={e => {
                            const updated = [...form.photos];
                            updated[index].dnNumber = e.target.value;
                            setForm({ ...form, photos: updated });
                          }}
                          style={{ width: '100%', padding: '3px 6px', border: `1px solid ${D.border}`, borderRadius: 4, fontSize: 11, textAlign: 'center', boxSizing: 'border-box', marginBottom: 4 }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <button type="button" style={W.qtyBtn} onClick={() => {
                            const updated = [...form.photos];
                            updated[index].sets = Math.max(0, updated[index].sets - 1);
                            setForm({ ...form, photos: updated });
                          }}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{photo.sets}</span>
                          <button type="button" style={W.qtyBtn} onClick={() => {
                            const updated = [...form.photos];
                            updated[index].sets = updated[index].sets + 1;
                            setForm({ ...form, photos: updated });
                          }}>+</button>
                        </div>
                        <p style={{ margin: '3px 0 4px', fontSize: 10, color: D.textSecondary }}>{photo.sets * pcsPerSet} pcs</p>
                        <button type="button" onClick={() => setForm({ ...form, photos: form.photos.filter((_, i) => i !== index) })}
                          style={{ fontSize: 10, color: D.error, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isNighty && form.photos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {form.photos.map((p, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={p.url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                      <button onClick={() => setForm({ ...form, photos: form.photos.filter((_, idx) => idx !== i) })}
                        style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: D.error, color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <div style={W.section}>
                <label style={W.label}>Product Name *</label>
                <input style={W.input} placeholder="e.g. Zinab Vol-1" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
                <label style={W.label}>Price per piece (₹) *</label>
                <input style={W.input} type="number" placeholder="e.g. 435" value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={W.label}>MOQ *</label>
                    <input style={W.input} type="number" placeholder="Min qty" value={form.moq}
                      onChange={e => setForm({ ...form, moq: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={W.label}>Unit</label>
                    <select style={W.input} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                      <option value="sets">Sets</option><option value="pieces">Pieces</option>
                      <option value="meters">Meters</option><option value="kg">KG</option><option value="yards">Yards</option>
                    </select>
                  </div>
                </div>
                <label style={W.label}>Description</label>
                <textarea style={{ ...W.input, height: 80, resize: 'none' }} placeholder="Product description"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div style={{ ...W.section, backgroundColor: '#e8edf5' }}>
                <p style={W.sectionTitle}>Summary</p>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: D.textSecondary }}>Category: <b style={{ color: D.navy }}>{form.category}</b></p>
                {form.cut && <p style={{ margin: '0 0 4px', fontSize: 13, color: D.textSecondary }}>Cut: <b style={{ color: D.navy }}>{form.cut}{form.cutValue ? ` — ${form.cutValue}` : ''}</b></p>}
                {form.sizes?.length > 0 && <p style={{ margin: '0 0 4px', fontSize: 13, color: D.textSecondary }}>Sizes: <b style={{ color: D.navy }}>{form.sizes.join(', ')}</b></p>}
                {form.material && <p style={{ margin: '0 0 4px', fontSize: 13, color: D.textSecondary }}>Material: <b style={{ color: D.navy }}>{form.material}</b></p>}
                <p style={{ margin: 0, fontSize: 13, color: D.textSecondary }}>Photos: <b style={{ color: D.navy }}>{form.photos.length}</b>{isNighty && ` · ${totalSets} sets`}</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ paddingTop: 16 }}>
          {step < 3 ? (
            <button style={{ ...W.btnPrimary, opacity: (step === 1 && !canNext1) || uploading ? 0.5 : 1 }}
              disabled={(step === 1 && !canNext1) || uploading}
              onClick={() => setStep(step + 1)}>
              Continue →
            </button>
          ) : (
            <button style={{ ...W.btnPrimary, opacity: !canSubmit ? 0.5 : 1 }}
              disabled={!canSubmit || loading}
              onClick={handleSubmit}>
              {loading ? 'Submitting...' : 'Submit for Approval ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Product Modal ──────────────────────────────────────
function EditProductModal({ product, onSave, onClose }) {
  const [ep, setEp] = useState({ ...product });
  const [editingDesigns, setEditingDesigns] = useState([]);
  const [editingPhotos, setEditingPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isNighty = NIGHTY_CATEGORIES.includes(product.category);
  const editPcsPerSet = product.category === 'Nighty with Dupatta' ? 20 : 30;

  useEffect(() => {
    const load = async () => {
      if (isNighty) {
        const snap = await getDocs(collection(db, 'products', product.id, 'designs'));
        setEditingDesigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setEditingPhotos(product.imageUrls || (product.imageUrl ? [product.imageUrl] : []));
      }
    };
    load();
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const toggleEditSize = (size) => {
    const cur = ep.sizes || [];
    setEp({ ...ep, sizes: cur.includes(size) ? cur.filter(s => s !== size) : [...cur, size] });
  };

  const handleAddPhotosInEdit = async (files) => {
    setUploading(true);
    const user = auth.currentUser;
    const newUrls = [];
    for (const file of Array.from(files).slice(0, 20)) {
      const imageRef = ref(storage, `products/${user.uid}/${product.id}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      newUrls.push(url);
    }
    const updated = [...editingPhotos, ...newUrls];
    setEditingPhotos(updated);
    await updateDoc(doc(db, 'products', product.id), { imageUrl: updated[0] || '', imageUrls: updated });
    setUploading(false);
  };

  const handleDeletePhoto = async (url) => {
    const updated = editingPhotos.filter(p => p !== url);
    setEditingPhotos(updated);
    await updateDoc(doc(db, 'products', product.id), { imageUrl: updated[0] || '', imageUrls: updated });
  };

  const handleAddDesigns = async (files) => {
    setUploading(true);
    const user = auth.currentUser;
    const files_arr = Array.from(files).slice(0, 20);
    const currentCount = editingDesigns.length;
    const newDesigns = [];
    let newTotal = ep.totalSets || 0;
    for (let i = 0; i < files_arr.length; i++) {
      const imageRef = ref(storage, `designs/${user.uid}/${product.id}/${Date.now()}_${files_arr[i].name}`);
      await uploadBytes(imageRef, files_arr[i]);
      const url = await getDownloadURL(imageRef);
      const docRef = await addDoc(collection(db, 'products', product.id, 'designs'), {
        designNo: currentCount + i + 1, dnNumber: '', sets: 1, photoUrl: url, addedAt: new Date(),
      });
      newDesigns.push({ id: docRef.id, designNo: currentCount + i + 1, dnNumber: '', sets: 1, photoUrl: url });
      newTotal += 1;
    }
    await updateDoc(doc(db, 'products', product.id), { totalSets: newTotal });
    setEp(prev => ({ ...prev, totalSets: newTotal }));
    setEditingDesigns(prev => [...prev, ...newDesigns]);
    setUploading(false);
  };

  const updateDesignSets = async (design, newSets) => {
    if (newSets < 0) return;
    const diff = newSets - design.sets;
    await updateDoc(doc(db, 'products', product.id, 'designs', design.id), { sets: newSets });
    const newTotal = Math.max(0, (ep.totalSets || 0) + diff);
    await updateDoc(doc(db, 'products', product.id), { totalSets: newTotal });
    setEp(prev => ({ ...prev, totalSets: newTotal }));
    setEditingDesigns(prev => prev.map(d => d.id === design.id ? { ...d, sets: newSets } : d));
  };

  const deleteDesign = async (design) => {
    if (!window.confirm('Delete this design?')) return;
    await deleteDoc(doc(db, 'products', product.id, 'designs', design.id));
    const newTotal = Math.max(0, (ep.totalSets || 0) - design.sets);
    await updateDoc(doc(db, 'products', product.id), { totalSets: newTotal });
    setEp(prev => ({ ...prev, totalSets: newTotal }));
    setEditingDesigns(prev => prev.filter(d => d.id !== design.id));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData = {
        name: ep.name, price: Number(ep.price), moq: Number(ep.moq),
        unit: ep.unit, description: ep.description || '',
      };
      if (isNighty) { updateData.cut = ep.cut; updateData.cutValue = ep.cutValue || ''; }
      if (STITCHED_CATEGORIES.includes(ep.category)) { updateData.sizes = ep.sizes || []; updateData.material = ep.material || ''; }
      if (ep.category === CHUDIDAR_CATEGORY) {
        updateData.productType = ep.productType || '';
        updateData.chudidarTop = ep.chudidarTop || '';
        updateData.chudidarBottom = ep.chudidarBottom || '';
        updateData.chudidarDupatta = ep.chudidarDupatta || '';
        updateData.chudidarTopMaterial = ep.chudidarTopMaterial || '';
        updateData.chudidarBottomMaterial = ep.chudidarBottomMaterial || '';
        updateData.chudidarDupattaMaterial = ep.chudidarDupattaMaterial || '';
      }
      await updateDoc(doc(db, 'products', product.id), updateData);
      onSave();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div style={W.overlay} onClick={onClose}>
      <div style={W.sheet} onClick={e => e.stopPropagation()}>
        <div style={W.handle} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button style={W.backBtn} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.navy }}>Edit — {ep.name}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={W.section}>
            <p style={W.sectionTitle}>Basic Details</p>
            <LabelInput label="Name" value={ep.name} onChange={v => setEp({ ...ep, name: v })} />
            <LabelInput label="Price ₹" value={ep.price} onChange={v => setEp({ ...ep, price: v })} placeholder="per piece" />
            <LabelInput label="MOQ" value={ep.moq} onChange={v => setEp({ ...ep, moq: v })} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
              <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 80, flexShrink: 0 }}>Unit</span>
              <select style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, backgroundColor: 'transparent', fontFamily: 'inherit' }}
                value={ep.unit} onChange={e => setEp({ ...ep, unit: e.target.value })}>
                <option value="sets">Sets</option><option value="pieces">Pieces</option>
                <option value="meters">Meters</option><option value="kg">KG</option><option value="yards">Yards</option>
              </select>
            </div>
            <textarea style={{ ...W.input, height: 60, resize: 'none', marginTop: 10 }} placeholder="Description"
              value={ep.description || ''} onChange={e => setEp({ ...ep, description: e.target.value })} />
          </div>

          {isNighty && (
            <div style={W.section}>
              <p style={W.sectionTitle}>Cut</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {CUT_OPTIONS.map(cut => (
                  <button key={cut} type="button"
                    style={(ep.cut || '').split(',').map(c=>c.trim()).includes(cut) ? W.tagActive : W.tag}
                    onClick={() => {
                      const selected = (ep.cut || '').split(',').map(c=>c.trim()).filter(Boolean);
                      const updated = selected.includes(cut) ? selected.filter(c => c !== cut) : [...selected, cut];
                      setEp({ ...ep, cut: updated.join(', ') });
                    }}>{cut}</button>
                ))}
              </div>
              <LabelInput label="Cut value" value={ep.cutValue || ''} onChange={v => setEp({ ...ep, cutValue: v })} placeholder="e.g. 2.5 meters" />
            </div>
          )}

          {STITCHED_CATEGORIES.includes(ep.category) && (
            <div style={W.section}>
              <p style={W.sectionTitle}>Sizes & Material</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {SIZES.map(size => (
                  <button key={size} type="button" style={(ep.sizes || []).includes(size) ? W.tagActive : W.tag}
                    onClick={() => toggleEditSize(size)}>{size}</button>
                ))}
              </div>
              <LabelInput label="Material" value={ep.material || ''} onChange={v => setEp({ ...ep, material: v })} />
            </div>
          )}

          {ep.category === CHUDIDAR_CATEGORY && (
            <div style={W.section}>
              <p style={W.sectionTitle}>Chudidar Details</p>
              <LabelInput label="Top" value={ep.chudidarTop || ''} onChange={v => setEp({ ...ep, chudidarTop: v })} placeholder="measurement" />
              <LabelInput label="Bottom" value={ep.chudidarBottom || ''} onChange={v => setEp({ ...ep, chudidarBottom: v })} placeholder="measurement" />
              <LabelInput label="Dupatta" value={ep.chudidarDupatta || ''} onChange={v => setEp({ ...ep, chudidarDupatta: v })} placeholder="measurement" />
              <div style={{ marginTop: 8 }}>
                <LabelInput label="Top Mat." value={ep.chudidarTopMaterial || ''} onChange={v => setEp({ ...ep, chudidarTopMaterial: v })} placeholder="material" />
                <LabelInput label="Bot. Mat." value={ep.chudidarBottomMaterial || ''} onChange={v => setEp({ ...ep, chudidarBottomMaterial: v })} placeholder="material" />
                <LabelInput label="Dup. Mat." value={ep.chudidarDupattaMaterial || ''} onChange={v => setEp({ ...ep, chudidarDupattaMaterial: v })} placeholder="material" />
              </div>
            </div>
          )}

          {!isNighty && (
            <div style={W.section}>
              <p style={W.sectionTitle}>Photos</p>
              <label style={{ ...W.uploadArea, padding: '12px', marginBottom: 10 }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleAddPhotosInEdit(e.target.files)} />
                <span style={{ fontSize: 13, color: D.navy, fontWeight: 600 }}>+ Add Photos</span>
              </label>
              {uploading && <p style={{ fontSize: 12, color: D.warning }}>Uploading...</p>}
              {editingPhotos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {editingPhotos.map((url, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                      <button onClick={() => handleDeletePhoto(url)}
                        style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: D.error, color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isNighty && (
            <div style={W.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={W.sectionTitle}>Designs</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>{ep.totalSets || 0} sets</span>
              </div>
              <label style={{ ...W.uploadArea, padding: '12px', marginBottom: 10 }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleAddDesigns(e.target.files)} />
                <span style={{ fontSize: 13, color: D.navy, fontWeight: 600 }}>+ Add Designs</span>
              </label>
              {uploading && <p style={{ fontSize: 12, color: D.warning }}>Uploading...</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {editingDesigns.map(design => (
                  <div key={design.id} style={W.designCard}>
                    <img src={design.photoUrl} alt="" style={W.designImg} />
                    <p style={{ margin: '6px 0 4px', fontSize: 11, fontWeight: 700, color: D.navy }}>DN {design.designNo}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <button style={W.qtyBtn} onClick={() => updateDesignSets(design, design.sets - 1)}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{design.sets}</span>
                      <button style={W.qtyBtn} onClick={() => updateDesignSets(design, design.sets + 1)}>+</button>
                    </div>
                    <p style={{ margin: '3px 0 4px', fontSize: 10, color: D.textSecondary }}>{design.sets * editPcsPerSet} pcs</p>
                    <button style={{ fontSize: 10, color: D.error, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => deleteDesign(design)}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ paddingTop: 16, display: 'flex', gap: 10 }}>
          <button style={W.btnPrimary} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
          <button style={W.btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Dispatch Details Modal ──────────────────────────────────
function DispatchModal({ order, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={W.overlay} onClick={onClose}>
      <div style={W.sheet} onClick={e => e.stopPropagation()}>
        <div style={W.handle} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button style={W.backBtn} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.navy }}>Dispatch Details</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={W.section}>
            {[
              ['Order ID', `#${order.id.slice(0, 8)}`],
              ['Buyer', order.buyerFirm || '—'],
              ['Payment', order.paymentStatus === 'Cleared' ? '✓ Fully Paid' : order.paymentStatus === 'Advance Received' ? '◑ Part Paid' : order.paymentStatus || '—'],
              ['Bill No', order.billNo || '—'],
              ['Bill Date', order.billDate || '—'],
              ['Transport', order.transport || '—'],
              ['LR No', order.lrNo || '—'],
              ['LR Date', order.lrDate || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: label === 'Payment' && val.includes('Paid') ? D.success : D.textPrimary, textAlign: 'right', maxWidth: '55%' }}>{val}</span>
              </div>
            ))}
            {order.sizeWisePayment && Object.keys(order.sizeWisePayment).length > 0 && (
              <div style={{ paddingTop: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: D.textSecondary, textTransform: 'uppercase' }}>Size-wise Qty</p>
                {Object.entries(order.sizeWisePayment).map(([size, qty]) => (
                  <div key={size} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                    <span style={{ fontSize: 13, color: D.textSecondary }}>Size {size}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: D.textPrimary }}>{qty} pcs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ paddingTop: 16 }}>
          <button style={W.btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── SupplierDashboard ────────────────────────────────────────
function SupplierDashboard() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [dispatchOrder, setDispatchOrder] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) { fetchProfile(); fetchProducts(); fetchOrders(); fetchCategories(); }
    });
    return () => unsubscribe();
  }, []);

  const fetchProfile = async () => {
    const user = auth.currentUser; if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) setUserProfile(snap.data());
  };
  const fetchCategories = async () => {
    const snap = await getDocs(collection(db, 'categories'));
    const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cats.sort((a, b) => a.name.localeCompare(b.name));
    setCategories(cats);
  };
  const fetchProducts = async () => {
    const user = auth.currentUser; if (!user) return;
    const q = query(collection(db, 'products'), where('supplierId', '==', user.uid));
    const snap = await getDocs(q);
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  const fetchOrders = async () => {
    const user = auth.currentUser; if (!user) return;
    const q = query(collection(db, 'orders'), where('supplierId', '==', user.uid));
    const snap = await getDocs(q);
    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    const designsSnap = await getDocs(collection(db, 'products', productId, 'designs'));
    const batch = writeBatch(db);
    designsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'products', productId));
    await batch.commit();
    fetchProducts();
  };

  const handleLogout = async () => { await signOut(auth); navigate('/'); };

  const getStatusStyle = (status) => {
    if (status === 'approved') return { backgroundColor: '#e6f4ea', color: D.success };
    if (status === 'delisted') return { backgroundColor: '#fce8e6', color: D.error };
    return { backgroundColor: '#fef7e0', color: D.warning };
  };

  const getOrderStatusStyle = (status) => {
    if (status === 'Delivered') return { bg: '#e6f4ea', color: D.success };
    if (status === 'Shipped') return { bg: '#e8f0fe', color: '#1a3a8f' };
    if (status === 'Processing') return { bg: '#fef7e0', color: D.warning };
    if (status === 'Cancelled') return { bg: '#fce8e6', color: D.error };
    return { bg: '#f1f3f4', color: D.textSecondary };
  };

  const tabs = [
    { id: 'products', label: 'Products', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'orders', label: 'Orders', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, count: orders.filter(o => o.status === 'Pending').length },
    { id: 'profile', label: 'Profile', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  return (
    <div style={S.appShell}>
      {showAddWizard && <AddProductWizard categories={categories} onDone={(rc) => { setShowAddWizard(false); fetchProducts(); if (rc) fetchCategories(); }} onCancel={() => setShowAddWizard(false)} />}
      {editingProduct && <EditProductModal product={editingProduct} onSave={() => { setEditingProduct(null); fetchProducts(); }} onClose={() => setEditingProduct(null)} />}
      {dispatchOrder && <DispatchModal order={dispatchOrder} onClose={() => setDispatchOrder(null)} />}

      {/* TOP BAR */}
      <div style={S.topBar}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, color: D.gold, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: D.navy, lineHeight: 1.2 }}>
            {activeTab === 'products' ? 'My Products' : activeTab === 'orders' ? 'My Orders' : 'Profile'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeTab === 'products' && (
            <button style={S.fabBtn} onClick={() => setShowAddWizard(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Add</span>
            </button>
          )}
          <LogoutBtn onLogout={handleLogout} />
        </div>
      </div>

      {/* MAIN */}
      <div style={S.mainContent}>

        {/* PRODUCTS */}
        {activeTab === 'products' && (
          <div style={{ padding: '8px 12px' }}>
            {products.length === 0 ? (
              <div style={{ padding: '80px 0', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, margin: '0 0 6px' }}>No products yet</p>
                <p style={{ fontSize: 13, color: D.textSecondary, margin: '0 0 20px' }}>Add your first product to get started</p>
                <button style={{ ...S.btnPrimary, width: 'auto', padding: '12px 24px', margin: '0 auto' }} onClick={() => setShowAddWizard(true)}>Add Product</button>
              </div>
            ) : (
              <div style={S.productGrid}>
                {products.map(product => (
                  <div key={product.id} style={S.productCard}>
                    {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={S.productImg} />}
                    <div style={{ padding: '10px 10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: D.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: D.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{product.category}</p>
                        </div>
                        <span style={{ ...S.statusBadge, ...getStatusStyle(product.status), marginLeft: 6 }}>{product.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <div><p style={S.detailLabel}>Price</p><p style={S.detailValue}>₹{product.price}</p></div>
                        <div><p style={S.detailLabel}>MOQ</p><p style={S.detailValue}>{product.moq}</p></div>
                        {NIGHTY_CATEGORIES.includes(product.category) && <div><p style={S.detailLabel}>Sets</p><p style={S.detailValue}>{product.totalSets || 0}</p></div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ ...S.btnSmall, backgroundColor: D.navyMid, color: 'white', flex: 1 }} onClick={() => setEditingProduct(product)}>Edit</button>
                        <button style={{ ...S.btnSmall, backgroundColor: '#fce8e6', color: D.error, flex: 1 }} onClick={() => deleteProduct(product.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div style={{ padding: '8px 16px' }}>
            {orders.length === 0 ? (
              <div style={{ padding: '80px 0', textAlign: 'center', color: D.textSecondary }}>No orders yet</div>
            ) : orders.map(order => {
              const st = getOrderStatusStyle(order.status);
              const isDelivered = order.status === 'Delivered';
              return (
                <div key={order.id} style={S.orderCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 13, color: D.navy }}>#{order.id.slice(0, 8)}</p>
                      <p style={{ margin: 0, fontSize: 12, color: D.textSecondary }}>
                        {order.buyerFirm} · {order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ backgroundColor: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{order.status || 'Pending'}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2"
                        style={{ transform: expandedOrder === order.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {expandedOrder === order.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D.borderLight}` }}>
                      {order.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                          {item.photoUrl && <img src={item.photoUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: D.textPrimary }}>{item.productName}</p>
                            {item.designNo && <span style={{ fontSize: 11, color: D.textSecondary }}>DN{item.designNo}</span>}
                            {item.size && <span style={{ fontSize: 11, color: D.textSecondary }}> · Size {item.size}</span>}
                          </div>
                          <span style={{ fontSize: 11, color: D.textSecondary, flexShrink: 0 }}>
                            {item.sets ? `${item.sets} sets = ${item.pcs} pcs` : `${item.quantity} ${item.unit || 'pc'}`}
                          </span>
                        </div>
                      ))}
                      {order.nightyDetails && (
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: D.textSecondary }}>
                          {order.nightyDetails.totalSets} sets · {order.nightyDetails.packingType} sets/bale · <b style={{ color: D.navy }}>{order.nightyDetails.totalBales} bale(s)</b>
                        </p>
                      )}
                      {/* Dispatch button for delivered orders */}
                      {isDelivered && (
                        <button style={{ ...S.btnPrimary, marginTop: 12, padding: '10px', fontSize: 13, backgroundColor: D.navyMid }}
                          onClick={() => setDispatchOrder(order)}>
                          📦 View Dispatch Details
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PROFILE */}
        {activeTab === 'profile' && userProfile && (
          <div style={{ padding: '8px 16px' }}>
            <SupplierProfileCard userProfile={userProfile} onSave={fetchProfile} onLogout={handleLogout} />
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={S.bottomNav}>
        {tabs.map(tab => (
          <button key={tab.id}
            style={{ ...S.navBtn, color: activeTab === tab.id ? D.navy : D.textSecondary }}
            onClick={() => setActiveTab(tab.id)}>
            <div style={{ position: 'relative' }}>
              {React.cloneElement(tab.icon, { stroke: activeTab === tab.id ? D.navy : D.textSecondary, strokeWidth: activeTab === tab.id ? 2.5 : 1.8 })}
              {tab.count > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -8, backgroundColor: D.error, color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 20, padding: '1px 5px', minWidth: 14, textAlign: 'center' }}>{tab.count}</span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 700 : 500, marginTop: 2 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Profile Card ─────────────────────────────────────────────
function SupplierProfileCard({ userProfile, onSave, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(userProfile);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setEditing(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    await updateDoc(doc(db, 'users', userProfile.uid), {
      firmName: form.firmName, contactPerson: form.contactPerson, mobile: form.mobile,
      address: form.address, city: form.city, district: form.district, state: form.state, pincode: form.pincode,
    });
    setLoading(false); setEditing(false); onSave();
  };

  if (!editing) {
    return (
      <div style={S.profileCard}>
        <div style={S.profileAvatar}>
          <span style={{ fontSize: 28, color: D.navy, fontWeight: 700 }}>{userProfile.firmName?.[0]?.toUpperCase()}</span>
        </div>
        <h3 style={{ margin: '12px 0 4px', color: D.textPrimary, fontSize: 18, fontWeight: 700 }}>{userProfile.firmName}</h3>
        <p style={{ margin: '0 0 20px', color: D.textSecondary, fontSize: 13 }}>{userProfile.email}</p>
        {[['GST Number', userProfile.gstNumber], ['Contact Person', userProfile.contactPerson],
          ['Mobile', userProfile.mobile], ['Address', userProfile.address],
          ['City', userProfile.city], ['District', userProfile.district],
          ['State', userProfile.state], ['Pincode', userProfile.pincode],
        ].map(([label, val]) => (
          <div key={label} style={S.profileRow}>
            <span style={S.profileLabel}>{label}</span>
            <span style={S.profileValue}>{val || '—'}</span>
          </div>
        ))}
        <button style={{ ...S.btnPrimary, marginTop: 20 }} onClick={() => setEditing(true)}>Edit Profile</button>
        <button style={{ ...S.btnGhost, marginTop: 10, borderColor: D.error, color: D.error }} onClick={onLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div style={S.profileCard}>
      <h3 style={{ margin: '0 0 4px', color: D.textPrimary }}>Edit Profile</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: D.textSecondary }}>Press ESC to cancel</p>
      {[['firmName', 'Firm Name'], ['contactPerson', 'Contact Person'], ['mobile', 'Mobile'],
        ['address', 'Address'], ['city', 'City'], ['district', 'District'], ['state', 'State'], ['pincode', 'Pincode'],
      ].map(([key, placeholder]) => (
        <input key={key} style={S.input} value={form[key] || ''} placeholder={placeholder}
          onChange={e => setForm({ ...form, [key]: e.target.value })} />
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={S.btnPrimary} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        <button style={S.btnGhost} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

const W = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { backgroundColor: D.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '12px 16px 32px', boxSizing: 'border-box' },
  handle: { width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '0 auto 16px' },
  backBtn: { width: 36, height: 36, borderRadius: 10, border: `1px solid ${D.borderLight}`, backgroundColor: D.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  section: { backgroundColor: D.bg, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${D.borderLight}` },
  sectionTitle: { margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: D.navy },
  label: { fontSize: 11, fontWeight: 600, color: D.textSecondary, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { display: 'block', width: '100%', padding: '11px 13px', border: `1.5px solid ${D.border}`, borderRadius: 8, fontSize: 14, color: D.textPrimary, outline: 'none', boxSizing: 'border-box', backgroundColor: D.surface, marginBottom: 10, fontFamily: 'inherit' },
  uploadArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', border: `2px dashed ${D.border}`, borderRadius: 12, cursor: 'pointer', backgroundColor: D.bg, textAlign: 'center' },
  tag: { padding: '8px 14px', border: `1.5px solid ${D.border}`, borderRadius: 8, cursor: 'pointer', backgroundColor: D.surface, fontSize: 13, color: D.textPrimary, fontWeight: 500 },
  tagActive: { padding: '8px 14px', border: `1.5px solid ${D.navy}`, borderRadius: 8, cursor: 'pointer', backgroundColor: D.navy, fontSize: 13, color: 'white', fontWeight: 700 },
  designCard: { backgroundColor: D.surface, borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', border: `1px solid ${D.borderLight}` },
  designImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 },
  qtyBtn: { width: 26, height: 26, border: `1px solid ${D.border}`, borderRadius: 6, cursor: 'pointer', backgroundColor: D.surface, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  addCatBtn: { marginTop: 4, padding: '7px 14px', backgroundColor: 'transparent', color: D.navy, border: `1px solid ${D.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.textSecondary, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};

const S = {
  appShell: { display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 480, margin: '0 auto', backgroundColor: D.bg, fontFamily: "'Inter', -apple-system, sans-serif", position: 'relative', overflow: 'hidden' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, flexShrink: 0, zIndex: 10 },
  fabBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: D.navy, border: 'none', borderRadius: 20, cursor: 'pointer' },
  mainContent: { flex: 1, overflowY: 'auto', paddingBottom: 80 },
  productGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  productCard: { backgroundColor: D.surface, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(3,22,50,0.06)', border: `1px solid ${D.borderLight}` },
  productImg: { width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' },
  statusBadge: { fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 },
  detailLabel: { margin: 0, fontSize: 9, color: D.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' },
  detailValue: { margin: '1px 0 0', fontSize: 13, fontWeight: 700, color: D.navy },
  orderCard: { backgroundColor: D.surface, borderRadius: 10, padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(3,22,50,0.06)', border: `1px solid ${D.borderLight}` },
  profileCard: { backgroundColor: D.surface, borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(3,22,50,0.06)', textAlign: 'center' },
  profileAvatar: { width: 64, height: 64, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
  profileRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${D.borderLight}`, textAlign: 'left' },
  profileLabel: { fontSize: 12, color: D.textSecondary, fontWeight: 500 },
  profileValue: { fontSize: 13, color: D.textPrimary, fontWeight: 600, textAlign: 'right', maxWidth: '60%' },
  input: { display: 'block', width: '100%', padding: '11px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, color: D.textPrimary, outline: 'none', boxSizing: 'border-box', marginBottom: 10, backgroundColor: D.surface },
  btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSmall: { padding: '8px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', backgroundColor: D.surface, borderTop: `1px solid ${D.borderLight}`, zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: 56 },
};

export default SupplierDashboard;