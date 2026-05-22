import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { notifyNewProduct } from '../../utils/notifications';

// Universal Product Templates
const TEMPLATES = [
  { id: 'sets', label: 'Fixed Sets (e.g. Nighty, Lingerie)', icon: '📦' },
  { id: 'stitched', label: 'Stitched Garments (e.g. Kurti, Dress)', icon: '👕' },
  { id: 'unstitched', label: 'Unstitched Suits (e.g. 3pc Chudidar)', icon: '🧵' },
  { id: 'running', label: 'Running Fabric (e.g. Thaan, Lump)', icon: '📜' },
];

const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const SET_CUT_OPTIONS = ['2/70', '2/90', '3/20'];
const RUNNING_CUT_OPTIONS = ['10 Meter', '20 Meter', '40 Meter', 'Full Lump'];

const D = {
  navy: '#031632', navyMid: '#1a2b48', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d',
  textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9',
  error: '#ba1a1a', success: '#1a6b3c', warning: '#7a5200',
};

// ── Shared UI Helpers ───────────────────────────────────────
function LabelInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <input type={type} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || `Enter ${label.toLowerCase()}`} />
    </div>
  );
}

function getSelectedItems(str) { return (str || '').split(',').map(c => c.trim()).filter(Boolean); }
function toggleItem(str, item) {
  const selected = getSelectedItems(str);
  return (selected.includes(item) ? selected.filter(c => c !== item) : [...selected, item]).join(', ');
}

// ── Add Product Wizard ──────────────────────────────────────
function AddProductWizard({ categories, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatTemplate, setNewCatTemplate] = useState('sets');
  
  const [form, setForm] = useState({
    name: '', categoryId: '', price: '', moq: '', unit: 'sets', description: '',
    cut: '', sizes: [], material: '', productType: 'stitched',
    chudidarTop: '', chudidarBottom: '', chudidarDupatta: '',
    chudidarTopMat: '', chudidarBottomMat: '', chudidarDupattaMat: '',
    runningType: 'fixed', fixedCuts: '', minCutLength: '',
    photos: [],
  });

  const selectedCategory = categories.find(c => c.id === form.categoryId);
  const template = selectedCategory?.template || '';

  const isSets = template === 'sets';
  const isStitched = template === 'stitched';
  const isUnstitched = template === 'unstitched';
  const isRunning = template === 'running';

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

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await addDoc(collection(db, 'categories'), { name: newCatName.trim(), template: newCatTemplate });
    setNewCatName(''); setAddingCategory(false);
    onDone(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const profile = userSnap.data();
      const productData = {
        name: form.name, categoryId: form.categoryId, categoryName: selectedCategory.name,
        price: Number(form.price), moq: Number(form.moq), unit: form.unit, description: form.description,
        template: template, supplierId: user.uid, supplierFirm: profile?.firmName || '',
        status: 'pending', createdAt: new Date(),
        imageUrl: form.photos[0]?.url || '',
        imageUrls: form.photos.map(p => ({ url: p.url, dnNumber: p.dnNumber || '' })),
      };

      if (isSets) {
        productData.cut = form.cut;
        productData.totalSets = form.photos.reduce((sum, p) => sum + p.sets, 0);
      }
      if (isStitched) { productData.sizes = form.sizes; productData.material = form.material; }
      if (isRunning) {
        productData.runningType = form.runningType;
        if (form.runningType === 'fixed') productData.fixedCuts = form.fixedCuts;
        else productData.minCutLength = Number(form.minCutLength);
      }
      if (isUnstitched) {
        productData.chudidarTop = form.chudidarTop; productData.chudidarBottom = form.chudidarBottom; productData.chudidarDupatta = form.chudidarDupatta;
        productData.chudidarTopMat = form.chudidarTopMat; productData.chudidarBottomMat = form.chudidarBottomMat; productData.chudidarDupattaMat = form.chudidarDupattaMat;
      }

      const productRef = await addDoc(collection(db, 'products'), productData);
      
      if (isSets) {
        for (let i = 0; i < form.photos.length; i++) {
          await addDoc(collection(db, 'products', productRef.id, 'designs'), {
            designNo: i + 1, dnNumber: form.photos[i].dnNumber || '',
            sets: form.photos[i].sets, photoUrl: form.photos[i].url, addedAt: new Date(),
          });
        }
      }
      onDone(false);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const canNext1 = form.categoryId &&
    (!isSets || form.cut) &&
    (!isStitched || (form.sizes.length > 0 && form.material)) &&
    (!isUnstitched || (form.chudidarTopMat && form.chudidarTop)) &&
    (!isRunning || (form.runningType === 'fixed' ? form.fixedCuts : form.minCutLength));

  return (
    <div style={W.overlay} onClick={onCancel}>
      <div style={W.sheet} onClick={e => e.stopPropagation()}>
        <div style={W.handle} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button style={W.backBtn} onClick={step === 1 ? onCancel : () => setStep(step - 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></button>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, color: D.textSecondary, fontWeight: 600 }}>STEP {step} OF 3</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: D.navy }}>{step === 1 ? 'Details' : step === 2 ? 'Photos' : 'Basic Info'}</p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {step === 1 && (
            <div>
              <div style={W.section}>
                <label style={W.label}>Category *</label>
                <select style={W.input} value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value, photos: [], sizes: [] })}>
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                {!addingCategory ? (
                  <button type="button" style={W.addCatBtn} onClick={() => setAddingCategory(true)}>+ New Category</button>
                ) : (
                  <div style={{ background: '#f0f4ff', padding: 12, borderRadius: 10, marginTop: 10 }}>
                    <input style={W.input} placeholder="Category Name" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                    <label style={W.label}>Behavior Template</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {TEMPLATES.map(t => (
                        <button key={t.id} style={newCatTemplate === t.id ? W.tagActive : W.tag} onClick={() => setNewCatTemplate(t.id)}>{t.icon} {t.id}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button style={{ ...W.btnPrimary, padding: '8px' }} onClick={handleAddCategory}>Save Category</button>
                      <button style={{ ...W.btnGhost, padding: '8px' }} onClick={() => setAddingCategory(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* DYNAMIC TEMPLATE FIELDS */}
              {isSets && (
                <div style={W.section}>
                  <label style={W.label}>Sets Cut *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {SET_CUT_OPTIONS.map(c => (
                      <button key={c} style={getSelectedItems(form.cut).includes(c) ? W.tagActive : W.tag} onClick={() => setForm({...form, cut: toggleItem(form.cut, c)})}>{c}</button>
                    ))}
                  </div>
                </div>
              )}

              {isStitched && (
                <div style={W.section}>
                  <label style={W.label}>Sizes *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {SIZES.map(s => (
                      <button key={s} style={form.sizes.includes(s) ? W.tagActive : W.tag} onClick={() => setForm({...form, sizes: form.sizes.includes(s) ? form.sizes.filter(x=>x!==s) : [...form.sizes, s]})}>{s}</button>
                    ))}
                  </div>
                  <LabelInput label="Material" value={form.material} onChange={v => setForm({...form, material: v})} />
                </div>
              )}

              {isRunning && (
                <div style={W.section}>
                  <label style={W.label}>Selling Logic *</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button style={form.runningType === 'fixed' ? W.tagActive : W.tag} onClick={() => setForm({...form, runningType: 'fixed'})}>Fixed Cuts</button>
                    <button style={form.runningType === 'flexible' ? W.tagActive : W.tag} onClick={() => setForm({...form, runningType: 'flexible'})}>Any Length</button>
                  </div>
                  {form.runningType === 'fixed' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {RUNNING_CUT_OPTIONS.map(c => (
                        <button key={c} style={getSelectedItems(form.fixedCuts).includes(c) ? W.tagActive : W.tag} onClick={() => setForm({...form, fixedCuts: toggleItem(form.fixedCuts, c)})}>{c}</button>
                      ))}
                    </div>
                  ) : (
                    <LabelInput label="Min Length" type="number" value={form.minCutLength} onChange={v => setForm({...form, minCutLength: v})} placeholder="e.g. 20m" />
                  )}
                </div>
              )}

              {isUnstitched && (
                <div style={W.section}>
                  <p style={W.sectionTitle}>Cuts & Materials</p>
                  <LabelInput label="Top" value={form.chudidarTop} onChange={v => setForm({...form, chudidarTop: v})} placeholder="e.g. 2.5m" />
                  <LabelInput label="Top Mat." value={form.chudidarTopMat} onChange={v => setForm({...form, chudidarTopMat: v})} />
                  <LabelInput label="Bottom" value={form.chudidarBottom} onChange={v => setForm({...form, chudidarBottom: v})} placeholder="e.g. 2m" />
                  <LabelInput label="Bot. Mat." value={form.chudidarBottomMat} onChange={v => setForm({...form, chudidarBottomMat: v})} />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={W.section}>
              <label style={W.uploadArea}>
                <input type="file" multiple style={{ display: 'none' }} onChange={e => handlePhotoUpload(e.target.files)} />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p style={{ margin: '8px 0 0', fontWeight: 600 }}>Upload Photos</p>
              </label>
              {uploading && <p style={{ textAlign: 'center', fontSize: 13, color: D.warning }}>Uploading...</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginTop: 12 }}>
                {form.photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={p.url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
                    {isSets && <input style={{ width: '100%', fontSize: 10, marginTop: 2 }} placeholder="DN No." onChange={e => {const u = [...form.photos]; u[i].dnNumber = e.target.value; setForm({...form, photos: u})}} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={W.section}>
              <LabelInput label="Name" value={form.name} onChange={v => setForm({...form, name: v})} />
              <LabelInput label="Price" type="number" value={form.price} onChange={v => setForm({...form, price: v})} />
              <LabelInput label="MOQ" type="number" value={form.moq} onChange={v => setForm({...form, moq: v})} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 80 }}>Unit</span>
                <select style={W.input} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                  <option value="sets">Sets</option><option value="pieces">Pieces</option><option value="meters">Meters</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{ paddingTop: 16 }}>
          {step < 3 ? (
            <button style={{ ...W.btnPrimary, opacity: canNext1 ? 1 : 0.5 }} disabled={!canNext1} onClick={() => setStep(step + 1)}>Continue →</button>
          ) : (
            <button style={W.btnPrimary} disabled={!form.name || loading} onClick={handleSubmit}>{loading ? 'Saving...' : 'Finish ✓'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Supplier Dashboard ──────────────────────────────────────
function SupplierDashboard() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) { fetchProducts(); fetchCategories(); fetchOrders(); }
    });
    return unsub;
  }, []);

  const fetchProducts = async () => {
    const q = query(collection(db, 'products'), where('supplierId', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchCategories = async () => {
    const snap = await getDocs(collection(db, 'categories'));
    setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchOrders = async () => {
    const q = query(collection(db, 'orders'), where('supplierId', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleLogout = () => { if (window.confirm('Logout?')) signOut(auth).then(() => navigate('/')); };

  return (
    <div style={S.appShell}>
      {showAdd && <AddProductWizard categories={categories} onDone={(rc) => { setShowAdd(false); fetchProducts(); if (rc) fetchCategories(); }} onCancel={() => setShowAdd(false)} />}
      
      <div style={S.topBar}>
        <div>
          <span style={{ fontSize: 11, color: D.gold, fontWeight: 700 }}>JAIN AGENCY</span>
          <h2 style={{ fontSize: 18, color: D.navy, margin: 0 }}>Supplier Panel</h2>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {activeTab === 'products' && (
            <button style={S.fabBtn} onClick={() => setShowAdd(true)}>+ Add Product</button>
          )}
          <button style={S.iconBtn} onClick={handleLogout} title="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div style={S.mainContent}>
        {activeTab === 'products' && (
          <div style={S.productGrid}>
            {products.map(p => (
              <div key={p.id} style={S.productCard}>
                <img src={p.imageUrl} style={S.productImg} />
                <div style={{ padding: 12 }}>
                  <p style={{ fontWeight: 700, margin: 0 }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: D.gold, fontWeight: 700 }}>{p.categoryName}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontWeight: 800 }}>₹{p.price}</span>
                    <span style={{ fontSize: 12, background: '#e6f4ea', padding: '2px 8px', borderRadius: 20 }}>{p.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'orders' && (
          <div style={{ padding: 16 }}>
            {orders.map(o => (
              <div key={o.id} style={S.orderCard} onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <b>#{o.id.slice(0, 8)}</b>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{o.status}</span>
                </div>
                <p style={{ fontSize: 13, margin: '4px 0 0' }}>Buyer: {o.buyerFirm}</p>
                {expandedOrder === o.id && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${D.borderLight}`, paddingTop: 10 }}>
                    {o.items?.map((item, i) => (
                      <p key={i} style={{ fontSize: 12, margin: '4px 0' }}>• {item.productName} ({item.quantity || item.sets} {item.unit})</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.bottomNav}>
        <button style={activeTab === 'products' ? S.navBtnActive : S.navBtn} onClick={() => setActiveTab('products')}>Inventory</button>
        <button style={activeTab === 'orders' ? S.navBtnActive : S.navBtn} onClick={() => setActiveTab('orders')}>Orders</button>
      </div>
    </div>
  );
}

const W = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: D.surface, borderRadius: '20px', width: '90%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' },
  handle: { width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '0 auto 16px' },
  backBtn: { width: 36, height: 36, borderRadius: 10, border: `1px solid ${D.borderLight}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  section: { backgroundColor: D.bg, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${D.borderLight}` },
  sectionTitle: { margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: D.navy },
  label: { fontSize: 11, fontWeight: 700, color: D.textSecondary, marginBottom: 6, display: 'block', textTransform: 'uppercase' },
  input: { display: 'block', width: '100%', padding: '11px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, outline: 'none', marginBottom: 10 },
  uploadArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', border: `2px dashed ${D.border}`, borderRadius: 12, cursor: 'pointer' },
  tag: { padding: '8px 12px', border: `1px solid ${D.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, backgroundColor: 'white' },
  tagActive: { padding: '8px 12px', border: `1px solid ${D.navy}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, backgroundColor: D.navy, color: 'white', fontWeight: 700 },
  btnPrimary: { width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { width: '100%', padding: '14px', backgroundColor: 'transparent', border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 15, cursor: 'pointer' },
  addCatBtn: { background: 'none', border: 'none', color: D.navy, fontWeight: 700, cursor: 'pointer', fontSize: 13, marginTop: 5 },
};

const S = {
  appShell: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: D.bg, overflow: 'hidden' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, zIndex: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fabBtn: { padding: '9px 16px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  mainContent: { flex: 1, overflowY: 'auto', paddingBottom: 80 },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, padding: 16 },
  productCard: { backgroundColor: D.surface, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: `1px solid ${D.borderLight}` },
  productImg: { width: '100%', aspectRatio: '3/4', objectFit: 'cover' },
  orderCard: { backgroundColor: D.surface, padding: 16, borderRadius: 12, marginBottom: 12, border: `1px solid ${D.borderLight}` },
  bottomNav: { position: 'fixed', bottom: 0, width: '100%', display: 'flex', backgroundColor: 'white', borderTop: `1px solid ${D.borderLight}`, height: 60 },
  navBtn: { flex: 1, border: 'none', background: 'none', color: D.textSecondary, fontWeight: 600 },
  navBtnActive: { flex: 1, border: 'none', background: 'none', color: D.navy, fontWeight: 800 },
};

export default SupplierDashboard;

