import React, { useState } from 'react';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';

const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const DEFAULT_NIGHTY_CUTS = ['2/70', '2/90', '3/20'];
const UNITS = ['Piece', 'Set', 'Dozen', 'Meter', 'KG', 'Yard', 'Roll', 'Bale', 'Bundle', 'Box', 'Carton'];
const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];
const RUNNING_WIDTHS = ['36"', '44"', '48"', '54"', '58"', '60"', '72"'];

const D = { navy: '#031632', gold: '#775a19', bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', warning: '#7a5200' };

// Helpers
async function uploadFile(file) {
  const user = auth.currentUser;
  const r = ref(storage, `designs/${user.uid}/${Date.now()}_${file.name}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

function Tag({ label, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{ padding: small ? '5px 10px' : '7px 13px', border: `1.5px solid ${active ? D.navy : D.border}`, borderRadius: 8, cursor: 'pointer', fontSize: small ? 12 : 13, fontWeight: active ? 700 : 500, backgroundColor: active ? D.navy : D.surface, color: active ? 'white' : D.textPrimary }}>{label}</button>
  );
}

function SectionBox({ title, children, required }) {
  return (
    <div style={{ backgroundColor: D.bg, borderRadius: 12, padding: 14, border: `1px solid ${D.borderLight}`, marginBottom: 12 }}>
      {title && <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: D.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}{required && <span style={{ color: D.error }}> *</span>}</p>}
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

function AddProductWizard({ categories, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    categoryId: '', cuts: [], customCutInput: '', isStitched: null, sizes: [], designMode: null, designs: [], fullSetStock: {}, width: '', customWidth: '', runningMeters: 0, runningPhotos: [], name: '', price: '', moq: '', unit: 'Piece', description: '', material: '',
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const selectedCat = categories.find(c => c.id === form.categoryId);
  const template = selectedCat?.template || '';
  const isNighty = NIGHTY_CATEGORIES.includes(selectedCat?.name || '');
  const isRunning = template === 'running';
  const isNonNighty = !isNighty && !!form.categoryId;

  const toggleCut = (label) => {
    const exists = form.cuts.find(c => c.label === label);
    if (exists) f('cuts', form.cuts.filter(c => c.label !== label));
    else f('cuts', [...form.cuts, { label, rate: '', designs: [] }]);
  };

  const addCustomCut = () => {
    const label = form.customCutInput.trim();
    if (!label || form.cuts.find(c => c.label === label)) return;
    f('cuts', [...form.cuts, { label, rate: '', designs: [] }]);
    f('customCutInput', '');
  };

  const updateCutRate = (cIdx, rate) => {
    const cuts = [...form.cuts];
    cuts[cIdx] = { ...cuts[cIdx], rate };
    f('cuts', cuts);
  };

  const handleNightyCutUpload = async (cIdx, files) => {
    setUploading(true);
    const newDesigns = [];
    for (const file of Array.from(files).slice(0, 30)) {
      const url = await uploadFile(file);
      newDesigns.push({ url, dnNumber: '', sets: 1 });
    }
    const cuts = [...form.cuts];
    cuts[cIdx] = { ...cuts[cIdx], designs: [...cuts[cIdx].designs, ...newDesigns] };
    f('cuts', cuts);
    setUploading(false);
  };

  const updateNightyCutDesign = (cIdx, dIdx, field, value) => {
    const cuts = [...form.cuts];
    cuts[cIdx].designs[dIdx] = { ...cuts[cIdx].designs[dIdx], [field]: value };
    f('cuts', cuts);
  };

  const makeEmptyStock = () => {
    if (form.isStitched && form.sizes.length > 0) return Object.fromEntries(form.sizes.map(s => [s, 0]));
    return { sets: 0 };
  };

  const handleDesignUpload = async (files) => {
    setUploading(true);
    const newDesigns = [];
    for (const file of Array.from(files).slice(0, 30)) {
      const url = await uploadFile(file);
      newDesigns.push({ url, dnNumber: '', stock: makeEmptyStock() });
    }
    f('designs', [...form.designs, ...newDesigns]);
    setUploading(false);
  };

  const handleRunningPhotoUpload = async (files) => {
    setUploading(true);
    const photos = [];
    for (const file of Array.from(files).slice(0, 10)) {
      const url = await uploadFile(file);
      photos.push(url);
    }
    f('runningPhotos', [...form.runningPhotos, ...photos]);
    setUploading(false);
  };

  const updateDesignStock = (idx, key, value) => {
    const designs = [...form.designs];
    designs[idx] = { ...designs[idx], stock: { ...designs[idx].stock, [key]: Number(value) } };
    f('designs', designs);
  };

  const updateFullSetStock = (key, value) => {
    f('fullSetStock', { ...form.fullSetStock, [key]: Number(value) });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const profile = userSnap.data();

      const base = {
        name: form.name, categoryId: form.categoryId, category: selectedCat.name, template, moq: Number(form.moq), unit: form.unit, description: form.description, supplierId: user.uid, supplierFirm: profile?.firmName || '', status: 'pending', createdAt: new Date(), isNighty,
      };

      if (isNighty) {
        base.cuts = form.cuts.map(c => c.label);
        base.cutRates = Object.fromEntries(form.cuts.map(c => [c.label, Number(c.rate || 0)]));
        base.price = Number(form.cuts[0]?.rate || 0);
        base.totalSets = form.cuts.reduce((s, c) => s + c.designs.reduce((ss, d) => ss + Number(d.sets || 0), 0), 0);
        base.imageUrl = form.cuts[0]?.designs[0]?.url || '';
        base.designMode = 'nighty';

        const productRef = await addDoc(collection(db, 'products'), base);
        for (const cut of form.cuts) {
          const cutRef = await addDoc(collection(db, 'products', productRef.id, 'cuts'), { label: cut.label, rate: Number(cut.rate || 0), createdAt: new Date() });
          for (let i = 0; i < cut.designs.length; i++) {
            const d = cut.designs[i];
            await addDoc(collection(db, 'products', productRef.id, 'cuts', cutRef.id, 'designs'), { designNo: i + 1, dnNumber: d.dnNumber || '', sets: Number(d.sets || 1), photoUrl: d.url, addedAt: new Date() });
          }
        }
      } else if (isRunning) {
        const width = form.width === 'custom' ? form.customWidth : form.width;
        base.price = Number(form.price);
        base.width = width;
        base.runningMeters = Number(form.runningMeters);
        base.imageUrl = form.runningPhotos[0] || '';
        base.imageUrls = form.runningPhotos.map(u => ({ url: u }));
        base.designMode = 'running';
        await addDoc(collection(db, 'products'), base);
      } else {
        base.price = Number(form.price);
        base.isStitched = form.isStitched;
        if (form.isStitched) { base.sizes = form.sizes; base.material = form.material; }
        base.designMode = form.designMode;

        if (form.designMode === 'fullset') {
          base.fullSetStock = form.fullSetStock;
          base.imageUrl = form.designs[0]?.url || '';
          base.imageUrls = form.designs.map(d => ({ url: d.url, dnNumber: d.dnNumber || '' }));
          await addDoc(collection(db, 'products'), base);
        } else {
          base.imageUrl = form.designs[0]?.url || '';
          const productRef = await addDoc(collection(db, 'products'), base);
          for (let i = 0; i < form.designs.length; i++) {
            const d = form.designs[i];
            await addDoc(collection(db, 'products', productRef.id, 'designs'), { designNo: i + 1, dnNumber: d.dnNumber || '', stock: d.stock, photoUrl: d.url, addedAt: new Date() });
          }
        }
      }
      onDone(false);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const canStep1 = (() => {
    if (!form.categoryId) return false;
    if (isNighty) return form.cuts.length > 0;
    if (isRunning) return !!(form.width || form.customWidth);
    if (isNonNighty) return form.isStitched !== null && form.designMode !== null && (form.isStitched === false || form.sizes.length > 0);
    return false;
  })();

  const canStep2 = (() => {
    if (isNighty) return form.cuts.length > 0 && form.cuts.every(c => c.designs.length > 0 && c.rate);
    if (isRunning) return true;
    if (form.designMode === 'fullset') return form.designs.length > 0;
    return form.designs.length > 0;
  })();

  const canSubmit = form.name && form.moq && (isNighty ? true : form.price) && canStep2;

  const renderDesignStock = (design, idx) => {
    if (form.isStitched && form.sizes.length > 0) {
      return (
        <div style={{ marginTop: 6 }}>
          <p style={{ fontSize: 10, color: D.textSecondary, margin: '0 0 5px', fontWeight: 700 }}>Stock per size:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {form.sizes.map(sz => (
              <div key={sz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 9, color: D.textSecondary, fontWeight: 700 }}>{sz}</span>
                <input type="number" min="0" value={design.stock?.[sz] || 0} onChange={e => updateDesignStock(idx, sz, e.target.value)} style={{ width: 42, padding: '3px', border: `1px solid ${D.border}`, borderRadius: 4, textAlign: 'center', fontSize: 11 }} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div style={{ marginTop: 4 }}>
        <input type="number" min="0" value={design.stock?.sets || 0} onChange={e => updateDesignStock(idx, 'sets', e.target.value)} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12 }} placeholder="Sets in stock" />
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ backgroundColor: D.surface, borderRadius: 20, width: '94%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '20px 20px 16px', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(3,22,50,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={step === 1 ? onCancel : () => setStep(step - 1)} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${D.borderLight}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: D.surface, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 10, color: D.textSecondary, fontWeight: 700, letterSpacing: '0.06em' }}>STEP {step} OF 3</p>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: D.navy }}>{step === 1 ? 'Category & Setup' : step === 2 ? 'Photos & Stock' : 'Name, Price & MOQ'}</p>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[1, 2, 3].map(s => <div key={s} style={{ width: s === step ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: s === step ? D.navy : s < step ? D.gold : D.borderLight, transition: 'all 0.2s' }} />)}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SectionBox title="Category" required>
                <select style={{ width: '100%', padding: '10px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, color: D.textPrimary, outline: 'none', backgroundColor: D.surface }} value={form.categoryId} onChange={e => {
                  const catId = e.target.value; const cat = categories.find(c => c.id === catId); const tmpl = cat?.template || '';
                  const autoStitched = tmpl === 'stitched' ? true : tmpl === 'unstitched' ? false : null;
                  setForm(prev => ({ ...prev, categoryId: catId, cuts: [], designs: [], sizes: [], isStitched: autoStitched, designMode: null, fullSetStock: {}, runningPhotos: [] }));
                }}>
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </SectionBox>

              {isNighty && (
                <SectionBox title="Available Cuts" required>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {DEFAULT_NIGHTY_CUTS.map(cut => <Tag key={cut} label={cut} active={!!form.cuts.find(c => c.label === cut)} onClick={() => toggleCut(cut)} />)}
                    {form.cuts.filter(c => !DEFAULT_NIGHTY_CUTS.includes(c.label)).map(c => (
                      <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tag label={c.label} active onClick={() => {}} />
                        <button onClick={() => toggleCut(c.label)} style={{ background: 'none', border: 'none', color: D.error, cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: '0 2px' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={form.customCutInput} onChange={e => f('customCutInput', e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomCut()} placeholder="Custom cut (e.g. 3/50)" style={{ flex: 1, padding: '8px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 13, outline: 'none' }} />
                    <button onClick={addCustomCut} style={{ padding: '8px 14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add</button>
                  </div>
                </SectionBox>
              )}

              {isRunning && (
                <SectionBox title="Fabric Width" required>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {RUNNING_WIDTHS.map(w => <Tag key={w} label={w} active={form.width === w} onClick={() => f('width', w)} />)}
                    <Tag label='Custom"' active={form.width === 'custom'} onClick={() => f('width', 'custom')} />
                  </div>
                  {form.width === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" value={form.customWidth} onChange={e => f('customWidth', e.target.value)} placeholder='e.g. 66' style={{ flex: 1, padding: '8px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, outline: 'none' }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: D.navy }}>"</span>
                    </div>
                  )}
                </SectionBox>
              )}

              {isNonNighty && !isRunning && (
                <>
                  {template !== 'stitched' && template !== 'unstitched' && (
                    <SectionBox title="Product Type" required>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[{ val: true, label: '✂️ Stitched', desc: 'Has sizes' }, { val: false, label: '🧵 Unstitched', desc: 'Sold as set' }].map(opt => (
                          <button key={String(opt.val)} onClick={() => f('isStitched', opt.val)} style={{ flex: 1, padding: '14px 10px', border: `2px solid ${form.isStitched === opt.val ? D.navy : D.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', backgroundColor: form.isStitched === opt.val ? D.navy : D.surface, color: form.isStitched === opt.val ? 'white' : D.textPrimary }}>
                            <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.label.split(' ')[0]}</div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.label.split(' ')[1]}</div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </SectionBox>
                  )}
                  {form.isStitched === true && (
                    <SectionBox title="Sizes Available" required>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {SIZES.map(s => <Tag key={s} label={s} active={form.sizes.includes(s)} onClick={() => f('sizes', form.sizes.includes(s) ? form.sizes.filter(x => x !== s) : [...form.sizes, s])} />)}
                      </div>
                    </SectionBox>
                  )}
                  {form.isStitched !== null && (
                    <SectionBox title="Stock Mode" required>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[{ val: 'fullset', icon: '📦', label: 'Full Set / Mixed', desc: 'All designs together' }, { val: 'design', icon: '🎨', label: 'Design Wise', desc: 'Each design stock' }].map(opt => (
                          <button key={opt.val} onClick={() => f('designMode', opt.val)} style={{ flex: 1, padding: '14px 10px', border: `2px solid ${form.designMode === opt.val ? D.navy : D.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', backgroundColor: form.designMode === opt.val ? D.navy : D.surface, color: form.designMode === opt.val ? 'white' : D.textPrimary }}>
                            <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </SectionBox>
                  )}
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isNighty && form.cuts.map((cut, cIdx) => (
                <SectionBox key={cut.label} title={`Cut ${cut.label}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}`, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 60 }}>Rate <span style={{ color: D.error }}>*</span></span>
                    <span style={{ fontSize: 14, color: D.textSecondary }}>₹</span>
                    <input type="number" value={cut.rate} onChange={e => updateCutRate(cIdx, e.target.value)} placeholder="Price per set" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent' }} />
                    <span style={{ fontSize: 12, color: D.textSecondary }}>/set</span>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', border: `2px dashed ${D.border}`, borderRadius: 10, cursor: 'pointer', marginBottom: 10 }}>
                    <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleNightyCutUpload(cIdx, e.target.files)} />
                    <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600 }}>+ Upload Designs</span>
                  </label>
                  {uploading && <p style={{ fontSize: 12, color: D.warning, textAlign: 'center' }}>Uploading...</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                    {cut.designs.map((d, dIdx) => (
                      <div key={dIdx} style={{ backgroundColor: D.surface, borderRadius: 8, overflow: 'hidden', border: `1px solid ${D.borderLight}` }}>
                        <img src={d.url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} alt="" />
                        <div style={{ padding: '5px 6px 7px' }}>
                          <input placeholder="DN No." value={d.dnNumber} onChange={e => updateNightyCutDesign(cIdx, dIdx, 'dnNumber', e.target.value)} style={{ width: '100%', fontSize: 10, border: `1px solid ${D.borderLight}`, borderRadius: 4, padding: '2px 4px', boxSizing: 'border-box', marginBottom: 3 }} />
                          <input type="number" min="1" value={d.sets} onChange={e => updateNightyCutDesign(cIdx, dIdx, 'sets', Number(e.target.value))} style={{ width: '100%', fontSize: 10, border: `1px solid ${D.borderLight}`, borderRadius: 4, padding: '2px 4px', boxSizing: 'border-box' }} placeholder="Sets" />
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionBox>
              ))}

              {isRunning && (
                <>
                  <SectionBox title="Product Photos">
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', border: `2px dashed ${D.border}`, borderRadius: 10, cursor: 'pointer', marginBottom: 10 }}>
                      <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleRunningPhotoUpload(e.target.files)} />
                      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600 }}>+ Upload Photos</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
                      {form.runningPhotos.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img src={url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} alt="" />
                          <button onClick={() => f('runningPhotos', form.runningPhotos.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', border: 'none', backgroundColor: D.error, color: 'white', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </SectionBox>
                  <SectionBox title="Meters in Stock" required>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="number" min="0" value={form.runningMeters} onChange={e => f('runningMeters', e.target.value)} style={{ width: 140, padding: '10px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 16, fontWeight: 700, color: D.navy, outline: 'none' }} />
                      <span style={{ fontSize: 14, color: D.textSecondary, fontWeight: 600 }}>meters</span>
                    </div>
                  </SectionBox>
                </>
              )}

              {!isNighty && !isRunning && form.designMode === 'fullset' && (
                <>
                  <SectionBox title="Product Photos" required>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', border: `2px dashed ${D.border}`, borderRadius: 10, cursor: 'pointer', marginBottom: 10 }}>
                      <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleDesignUpload(e.target.files)} />
                      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600 }}>+ Upload Photos</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
                      {form.designs.map((d, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img src={d.url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} alt="" />
                          <button onClick={() => f('designs', form.designs.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', border: 'none', backgroundColor: D.error, color: 'white', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </SectionBox>
                  <SectionBox title={form.isStitched ? 'Stock per Size' : 'Sets in Stock'} required>
                    {form.isStitched && form.sizes.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {form.sizes.map(sz => (
                          <div key={sz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: D.navy }}>{sz}</span>
                            <input type="number" min="0" value={form.fullSetStock[sz] || 0} onChange={e => updateFullSetStock(sz, e.target.value)} style={{ width: 56, padding: '7px', border: `1px solid ${D.border}`, borderRadius: 6, textAlign: 'center', fontSize: 14, fontWeight: 700 }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="number" min="0" value={form.fullSetStock.sets || 0} onChange={e => updateFullSetStock('sets', e.target.value)} style={{ width: 120, padding: '10px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 16, fontWeight: 700, color: D.navy, outline: 'none' }} />
                        <span style={{ fontSize: 14, color: D.textSecondary }}>sets</span>
                      </div>
                    )}
                  </SectionBox>
                </>
              )}

              {!isNighty && !isRunning && form.designMode === 'design' && (
                <SectionBox title="Designs & Stock" required>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', border: `2px dashed ${D.border}`, borderRadius: 10, cursor: 'pointer', marginBottom: 12 }}>
                    <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleDesignUpload(e.target.files)} />
                    <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600 }}>+ Upload Design Photos</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {form.designs.map((d, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, backgroundColor: D.surface, borderRadius: 10, padding: 10, border: `1px solid ${D.borderLight}` }}>
                        <img src={d.url} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} alt="" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input placeholder="DN Number (optional)" value={d.dnNumber} onChange={e => { const ds = [...form.designs]; ds[idx].dnNumber = e.target.value; f('designs', ds); }} style={{ width: '100%', fontSize: 12, border: `1px solid ${D.borderLight}`, borderRadius: 6, padding: '5px 8px', boxSizing: 'border-box', marginBottom: 6 }} />
                          {renderDesignStock(d, idx)}
                        </div>
                        <button onClick={() => f('designs', form.designs.filter((_, i) => i !== idx))} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', backgroundColor: '#fce8e6', color: D.error, cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-start' }}>✕</button>
                      </div>
                    ))}
                  </div>
                </SectionBox>
              )}
            </div>
          )}

          {step === 3 && (
            <SectionBox>
              <TextInput label="Product Name" value={form.name} onChange={v => f('name', v)} required />
              {isNighty ? (
                <div style={{ padding: '9px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: D.textSecondary, fontWeight: 600 }}>Rate per Cut <span style={{ color: D.error }}>*</span></p>
                  {form.cuts.map((cut, cIdx) => (
                    <div key={cut.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, minWidth: 50 }}>{cut.label}</span>
                      <span style={{ color: D.textSecondary }}>₹</span>
                      <input type="number" value={cut.rate} onChange={e => updateCutRate(cIdx, e.target.value)} style={{ flex: 1, padding: '7px 10px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 14, outline: 'none' }} placeholder="Rate per set" />
                      <span style={{ fontSize: 12, color: D.textSecondary }}>/set</span>
                    </div>
                  ))}
                </div>
              ) : (
                <TextInput label="Price (₹)" type="number" value={form.price} onChange={v => f('price', v)} required placeholder="Per unit" />
              )}
              <TextInput label="MOQ" type="number" value={form.moq} onChange={v => f('moq', v)} required placeholder="Min order qty" />
              <LabelRow label="Unit" required>
                <select style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent' }} value={form.unit} onChange={e => f('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </LabelRow>
              {(form.isStitched || (!isNighty && !isRunning)) && form.isStitched && (
                <TextInput label="Material" value={form.material} onChange={v => f('material', v)} placeholder="e.g. Cotton, Rayon" />
              )}
              <div style={{ padding: '9px 0' }}>
                <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</span>
                <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={3} placeholder="Optional" style={{ width: '100%', border: `1px solid ${D.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </SectionBox>
          )}
        </div>

        <div style={{ paddingTop: 14 }}>
          {step < 3 ? (
            <button disabled={step === 1 ? !canStep1 : !canStep2} onClick={() => setStep(step + 1)} style={{ width: '100%', padding: '14px', backgroundColor: (step === 1 ? canStep1 : canStep2) ? D.navy : D.border, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: (step === 1 ? canStep1 : canStep2) ? 'pointer' : 'not-allowed' }}>
              Continue →
            </button>
          ) : (
            <button disabled={!canSubmit || loading} onClick={handleSubmit} style={{ width: '100%', padding: '14px', backgroundColor: canSubmit ? D.navy : D.border, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
              {loading ? 'Saving...' : 'Submit Product ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddProductWizard;