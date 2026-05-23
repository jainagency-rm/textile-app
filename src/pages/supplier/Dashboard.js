import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc,
  getDoc, writeBatch, onSnapshot, orderBy, deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { useWindowSize } from '../../hooks/useWindowSize';

const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const DEFAULT_NIGHTY_CUTS = ['2/70', '2/90', '3/20'];
const UNITS = ['Piece', 'Set', 'Dozen', 'Meter', 'KG', 'Yard', 'Roll', 'Bale', 'Bundle', 'Box', 'Carton'];
const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];
const RUNNING_WIDTHS = ['36"', '44"', '48"', '54"', '58"', '60"', '72"'];

const D = {
  navy: '#031632', navyMid: '#1a2b48', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d',
  textSecondary: '#44474d', border: '#c5c6ce', borderLight: '#e7e8e9',
  error: '#ba1a1a', success: '#1a6b3c', warning: '#7a5200',
};

// ── Helpers ─────────────────────────────────────────────────
async function notifySupplier(supplierId, buyerFirm) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: supplierId, type: 'new_order',
      message: `New order from ${buyerFirm}`, read: false, createdAt: new Date(),
    });
  } catch (e) { console.error('Notify error', e); }
}


async function exportOrderPDF(order) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy = [3, 22, 50], gray = [100, 116, 139], lightGray = [241, 245, 249], W = 210, margin = 16;
  pdf.setFillColor(...navy); pdf.rect(0, 0, W, 38, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
  pdf.text('JAIN AGENCY', margin, 15);
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200, 200, 200);
  pdf.text('Supplier Order Receipt', margin, 22);
  pdf.setFontSize(11); pdf.setTextColor(255, 255, 255);
  pdf.text(`Order #${order.id.slice(0, 8).toUpperCase()}`, W - margin, 15, { align: 'right' });
  pdf.setFontSize(9); pdf.setTextColor(200, 200, 200);
  pdf.text(order.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || '', W - margin, 22, { align: 'right' });
  let y = 46;
  pdf.setFillColor(...lightGray); pdf.roundedRect(margin, y, W - margin * 2, 22, 3, 3, 'F');
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...navy);
  pdf.text('Buyer:', margin + 4, y + 8); pdf.setFont('helvetica', 'normal');
  pdf.text(order.buyerFirm || '—', margin + 18, y + 8);
  pdf.setFont('helvetica', 'bold'); pdf.text('Status:', margin + 4, y + 17);
  pdf.setFont('helvetica', 'normal'); pdf.text(order.status || 'Pending', margin + 20, y + 17);
  y += 30;
  pdf.setTextColor(...navy); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text('ORDER ITEMS', margin, y); y += 6;
  pdf.setFillColor(...navy); pdf.rect(margin, y, W - margin * 2, 8, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
  pdf.text('Product', margin + 3, y + 5.5); pdf.text('Design/Size', margin + 85, y + 5.5);
  pdf.text('Ordered', margin + 130, y + 5.5); pdf.text('Dispatched', margin + 155, y + 5.5);
  pdf.text('Unit', margin + 178, y + 5.5); y += 8;
  (order.items || []).forEach((item, idx) => {
    if (idx % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, W - margin * 2, 7, 'F'); }
    pdf.setTextColor(...navy); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text((item.productName || '').slice(0, 32), margin + 3, y + 5);
    const ds = item.designNo ? `DN${item.designNo}` : item.size ? `Sz ${item.size}` : '—';
    pdf.text(ds, margin + 85, y + 5);
    pdf.text(String(item.orderedQty || item.quantity || item.sets || 0), margin + 130, y + 5);
    pdf.setTextColor(22, 163, 74); pdf.text(String(item.dispatchedQty || 0), margin + 155, y + 5);
    pdf.setTextColor(...gray); pdf.text(item.unit || 'Piece', margin + 178, y + 5); y += 7;
  });
  if (order.nightyDetails) {
    y += 3; pdf.setTextColor(...gray); pdf.setFontSize(8);
    pdf.text(`Packing: ${order.nightyDetails.totalSets} sets · ${order.nightyDetails.packingType}/bale · ${order.nightyDetails.totalBales} bales`, margin, y); y += 6;
  }
  const shipments = order.shipments || [];
  if (shipments.length > 0) {
    y += 6; pdf.setTextColor(...navy); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
    pdf.text('DISPATCH HISTORY', margin, y); y += 6;
    shipments.forEach((ship, idx) => {
      if (y > 250) { pdf.addPage(); y = 20; }
      pdf.setFillColor(...lightGray); pdf.roundedRect(margin, y, W - margin * 2, 9, 2, 2, 'F');
      pdf.setFillColor(...navy); pdf.roundedRect(margin, y, 3, 9, 1, 1, 'F');
      pdf.setTextColor(...navy); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text(`Dispatch ${idx + 1}${ship.billDate ? ` (${ship.billDate})` : ''}`, margin + 6, y + 6.5); y += 9;
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...gray);
      const det = [ship.billNo && `Bill: ${ship.billNo}`, ship.transport && `Transport: ${ship.transport}`, ship.lrNo && `LR: ${ship.lrNo}`].filter(Boolean).join('   ');
      pdf.text(det, margin + 4, y + 5); y += 8;
      (ship.items || []).forEach(i => { pdf.setTextColor(...navy); pdf.setFontSize(8); pdf.text(`• ${i.productName}${i.size ? ` (${i.size})` : ''}: ${i.qty} ${i.unit || ''}`, margin + 6, y + 4); y += 6; });
      y += 2;
    });
  }
  y = 285; pdf.setFillColor(...navy); pdf.rect(0, y, W, 12, 'F');
  pdf.setTextColor(200, 200, 200); pdf.setFontSize(8);
  pdf.text('Jain Agency — Supplier Copy', margin, y + 8);
  pdf.text('Page 1', W - margin, y + 8, { align: 'right' });
  pdf.save(`Order_${order.id.slice(0, 8)}.pdf`);
}

function statusStyle(status) {
  if (status === 'Delivered') return { bg: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped' || status === 'Processing') return { bg: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Partially Dispatched') return { bg: '#fff3e0', color: '#7a5200' };
  if (status === 'Cancelled') return { bg: '#fce8e6', color: '#ba1a1a' };
  return { bg: '#f1f3f4', color: '#44474d' };
}

// ── UI atoms ─────────────────────────────────────────────────
function Tag({ label, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '5px 10px' : '7px 13px',
      border: `1.5px solid ${active ? D.navy : D.border}`,
      borderRadius: 8, cursor: 'pointer',
      fontSize: small ? 12 : 13, fontWeight: active ? 700 : 500,
      backgroundColor: active ? D.navy : D.surface,
      color: active ? 'white' : D.textPrimary,
    }}>{label}</button>
  );
}

function SectionBox({ title, children, required }) {
  return (
    <div style={{ backgroundColor: D.bg, borderRadius: 12, padding: 14, border: `1px solid ${D.borderLight}`, marginBottom: 12 }}>
      {title && <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: D.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}{required && <span style={{ color: D.error }}> *</span>}
      </p>}
      {children}
    </div>
  );
}

function LabelRow({ label, required, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${D.borderLight}` }}>
      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 90, flexShrink: 0 }}>
        {label}{required && <span style={{ color: D.error }}>*</span>}
      </span>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <LabelRow label={label} required={required}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''}
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }} />
    </LabelRow>
  );
}

// ── Upload helper ────────────────────────────────────────────
async function uploadFile(file) {
  const user = auth.currentUser;
  const r = ref(storage, `designs/${user.uid}/${Date.now()}_${file.name}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

// ── Add Product Wizard ───────────────────────────────────────
function AddProductWizard({ categories, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    categoryId: '',
    cuts: [],
    customCutInput: '',
    isStitched: null,
    sizes: [],
    designMode: null,
    designs: [],
    fullSetStock: {},
    width: '',
    customWidth: '',
    runningMeters: 0,
    runningPhotos: [],
    name: '', price: '', moq: '', unit: 'Piece', description: '',
    material: '',
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
        name: form.name, categoryId: form.categoryId, category: selectedCat.name, template,
        moq: Number(form.moq), unit: form.unit, description: form.description,
        supplierId: user.uid, supplierFirm: profile?.firmName || '',
        status: 'pending', createdAt: new Date(), isNighty,
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
            await addDoc(collection(db, 'products', productRef.id, 'cuts', cutRef.id, 'designs'), {
              designNo: i + 1, dnNumber: d.dnNumber || '', sets: Number(d.sets || 1), photoUrl: d.url, addedAt: new Date(),
            });
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
            await addDoc(collection(db, 'products', productRef.id, 'designs'), {
              designNo: i + 1, dnNumber: d.dnNumber || '', stock: d.stock, photoUrl: d.url, addedAt: new Date(),
            });
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

// ── NEW FULLY EDITABLE EditProductModal ─────────────────────────────
// ── NEW FULLY EDITABLE EditProductModal ─────────────────────────────
function EditProductModal({ product, onClose, onSaved }) {
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
    if (urls.length === 0 && product.imageUrl) {
      urls = [{ url: product.imageUrl, dnNumber: '' }];
    }
    return { ...product, designMode: mode, imageUrls: urls };
  });

  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loadingTab2, setLoadingTab2] = useState(false);
  const [nightyCuts, setNightyCuts] = useState([]);
  const [selectionDesigns, setSelectionDesigns] = useState([]);
  const [uploadingTab2, setUploadingTab2] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [pendingStock, setPendingStock] = useState(null); // local edits before save

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  // Init pendingStock from info on mount
  useEffect(() => {
    setPendingStock(info.fullSetStock || {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setError(null);
    if (activeTab === 1) loadTab2Data();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTab2Data = async () => {
    setLoadingTab2(true);
    try {
      if (info.designMode === 'nighty') {
        const cutsSnap = await getDocs(collection(db, 'products', product.id, 'cuts'));
        const cutsData = await Promise.all(
          cutsSnap.docs.map(async (cutDoc) => {
            const designsSnap = await getDocs(
              collection(db, 'products', product.id, 'cuts', cutDoc.id, 'designs')
            );
            return {
              id: cutDoc.id,
              ...cutDoc.data(),
              designs: designsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            };
          })
        );
        setNightyCuts(cutsData);
      } else if (info.designMode === 'design') {
        const designsSnap = await getDocs(collection(db, 'products', product.id, 'designs'));
        setSelectionDesigns(designsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      showError('Failed to load: ' + err.message);
    }
    setLoadingTab2(false);
  };

  // ── TAB 1: Save only specific fields ──────────────────────────────
  const handleSaveBasicInfo = async () => {
    setIsSavingBasic(true);
    setError(null);
    try {
      // FIX 1: Never push entire info object — only specific fields
      const payload = {
        name: info.name,
        moq: Number(info.moq) || 0,
        unit: info.unit,
        description: info.description || '',
      };

      if (info.isNighty) {
        payload.cutRates = info.cutRates || {};
        // Sync price to first cut rate for backwards compat
        const firstRate = Object.values(info.cutRates || {})[0];
        if (firstRate) payload.price = Number(firstRate);
      } else {
        payload.price = Number(info.price) || 0;
      }

      if (info.isStitched) {
        payload.material = info.material || '';
      }

      if (info.template === 'running') {
        payload.width = info.width || '';
        payload.runningMeters = Number(info.runningMeters) || 0;
      }

      await updateDoc(doc(db, 'products', product.id), payload);

      const updated = { ...info, ...payload };
      setInfo(updated);
      onSaved(updated, false); // don't close — let user continue
      showSuccess('Basic info saved!');
    } catch (err) {
      showError('Save failed: ' + err.message);
    }
    setIsSavingBasic(false);
  };

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

  // ── TAB 2: Nighty ─────────────────────────────────────────────────
  // FIX 4: Multiple files support for nighty design upload
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
        // FIX 2: Sequential designNo based on existing count
        const designNo = existingCount + i + 1;
        const newDesign = { designNo, dnNumber: '', sets: 0, photoUrl: url, addedAt: new Date() };
        const docRef = await addDoc(
          collection(db, 'products', product.id, 'cuts', cutId, 'designs'),
          newDesign
        );
        newDesigns.push({ id: docRef.id, ...newDesign });
      }

      setNightyCuts(prev => prev.map(cut =>
        cut.id === cutId
          ? { ...cut, designs: [...cut.designs, ...newDesigns] }
          : cut
      ));
      showSuccess(`${newDesigns.length} design(s) added`);
    } catch (err) { showError(err.message); }
    setUploadingTab2(false);
  };

  const handleNightyDesignUpdate = async (cutId, designId, field, value) => {
    try {
      await updateDoc(
        doc(db, 'products', product.id, 'cuts', cutId, 'designs', designId),
        { [field]: value }
      );
      setNightyCuts(prev => prev.map(cut =>
        cut.id === cutId
          ? { ...cut, designs: cut.designs.map(d => d.id === designId ? { ...d, [field]: value } : d) }
          : cut
      ));
    } catch (err) { showError(err.message); }
  };

  const handleNightyDesignDelete = async (cutId, designId, photoUrl) => {
    if (!window.confirm('Delete this design?')) return;
    try {
      await deleteDoc(doc(db, 'products', product.id, 'cuts', cutId, 'designs', designId));
      await deletePhotoFromStorage(photoUrl);
      setNightyCuts(prev => prev.map(cut =>
        cut.id === cutId
          ? { ...cut, designs: cut.designs.filter(d => d.id !== designId) }
          : cut
      ));
      showSuccess('Design deleted');
    } catch (err) { showError(err.message); }
  };

  // ── TAB 2: Selection/Design-wise ──────────────────────────────────
  // FIX 4: Multiple files for selection designs too
  const handleSelectionDesignUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const existingCount = selectionDesigns.length;
      const newDesigns = [];

      for (let i = 0; i < files.length; i++) {
        const url = await uploadPhotoModal(files[i]);
        const defaultStock = info.isStitched
          ? (info.sizes || []).reduce((acc, size) => ({ ...acc, [size]: 0 }), {})
          : { sets: 0 };
        // FIX 2: Sequential designNo
        const designNo = existingCount + i + 1;
        const newDesign = { designNo, dnNumber: '', stock: defaultStock, photoUrl: url, addedAt: new Date() };
        const docRef = await addDoc(
          collection(db, 'products', product.id, 'designs'),
          newDesign
        );
        newDesigns.push({ id: docRef.id, ...newDesign });
      }

      setSelectionDesigns(prev => [...prev, ...newDesigns]);
      showSuccess(`${newDesigns.length} design(s) added`);
    } catch (err) { showError(err.message); }
    setUploadingTab2(false);
  };

  const handleSelectionDesignUpdate = async (designId, field, value, isStock = false) => {
    try {
      const updateData = isStock
        ? { [`stock.${field}`]: Number(value) }
        : { [field]: value };
      await updateDoc(doc(db, 'products', product.id, 'designs', designId), updateData);
      setSelectionDesigns(prev => prev.map(d => {
        if (d.id !== designId) return d;
        return isStock
          ? { ...d, stock: { ...d.stock, [field]: Number(value) } }
          : { ...d, [field]: value };
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

  // ── TAB 2: Main photos (fullset / running) ────────────────────────
  // FIX 4: Multiple files for main photos
  const handleMainPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingTab2(true);
    try {
      const newEntries = [];
      for (const file of files) {
        const url = await uploadPhotoModal(file);
        newEntries.push({ url, dnNumber: '' });
      }
      // FIX 6: Use functional updater to avoid stale closure
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
        const newUrls = prev.imageUrls.map((img, i) =>
          i === index ? { ...img, dnNumber } : img
        );
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

  // ── TAB 2: Fullset stock — local edit + explicit Save button ──────
  const handleFullsetStockLocalChange = (field, value) => {
    setPendingStock(prev => ({ ...prev, [field]: Number(value) }));
  };

  const handleSaveFullsetStock = async () => {
    setSavingStock(true);
    try {
      await updateDoc(doc(db, 'products', product.id), { fullSetStock: pendingStock });
      setInfo(prev => {
        const updated = { ...prev, fullSetStock: pendingStock };
        onSaved(updated, false);
        return updated;
      });
      showSuccess('Stock saved!');
    } catch (err) { showError(err.message); }
    setSavingStock(false);
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: D.bg, borderRadius: 20, width: '94%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(3,22,50,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: D.navy, padding: '16px 20px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'white' }}>Edit Product</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, flexShrink: 0 }}>
          {['Basic Info', 'Photos & Stock'].map((label, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: '14px', border: 'none', borderBottom: activeTab === i ? `2px solid ${D.gold}` : '2px solid transparent', backgroundColor: 'transparent', color: activeTab === i ? D.gold : D.textSecondary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Toast messages */}
        {error && (
          <div style={{ backgroundColor: '#fce8e6', color: D.error, padding: '10px 20px', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            ⚠ {error}
          </div>
        )}
        {successMsg && (
          <div style={{ backgroundColor: '#e6f4ea', color: D.success, padding: '10px 20px', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── TAB 1: Basic Info ── */}
          {activeTab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SectionBox>
                <TextInput label="Product Name" value={info.name || ''} onChange={v => setInfo({ ...info, name: v })} required />

                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    <TextInput label="MOQ" type="number" value={info.moq || ''} onChange={v => setInfo({ ...info, moq: v })} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <LabelRow label="Unit" required>
                      <select
                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent' }}
                        value={info.unit || ''}
                        onChange={e => setInfo({ ...info, unit: e.target.value })}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </LabelRow>
                  </div>
                </div>

                {info.isStitched && (
                  <TextInput label="Material" value={info.material || ''} onChange={v => setInfo({ ...info, material: v })} />
                )}

                {info.template === 'running' && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <div style={{ flex: 1 }}>
                      <TextInput label='Width (e.g. 44")' value={info.width || ''} onChange={v => setInfo({ ...info, width: v })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextInput label="Meters" type="number" value={info.runningMeters || ''} onChange={v => setInfo({ ...info, runningMeters: v })} />
                    </div>
                  </div>
                )}

                {/* Pricing */}
                {info.isNighty ? (
                  <div style={{ padding: '12px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: D.textSecondary, fontWeight: 700 }}>Rate per Cut</p>
                    {(info.cuts || []).map(cut => (
                      <div key={cut} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, minWidth: 50 }}>{cut}</span>
                        <span style={{ color: D.textSecondary }}>₹</span>
                        <input
                          type="number"
                          value={info.cutRates?.[cut] || ''}
                          onChange={e => setInfo({ ...info, cutRates: { ...info.cutRates, [cut]: Number(e.target.value) } })}
                          style={{ flex: 1, padding: '8px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, outline: 'none' }}
                          placeholder="Rate per set"
                        />
                        <span style={{ fontSize: 12, color: D.textSecondary }}>/set</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <TextInput label="Price (₹)" type="number" value={info.price || ''} onChange={v => setInfo({ ...info, price: v })} required />
                )}

                <div style={{ padding: '12px 0 4px' }}>
                  <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 8 }}>Description</span>
                  <textarea
                    value={info.description || ''}
                    onChange={e => setInfo({ ...info, description: e.target.value })}
                    rows={3}
                    style={{ width: '100%', border: `1px solid ${D.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </SectionBox>

              <button
                onClick={handleSaveBasicInfo}
                disabled={isSavingBasic}
                style={{ width: '100%', padding: '14px', backgroundColor: isSavingBasic ? D.border : D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: isSavingBasic ? 'not-allowed' : 'pointer', marginTop: 10 }}
              >
                {isSavingBasic ? 'Saving...' : 'Save Basic Info ✓'}
              </button>
            </div>
          )}

          {/* ── TAB 2: Photos & Stock ── */}
          {activeTab === 1 && (
            <div>
              {loadingTab2 && (
                <p style={{ textAlign: 'center', fontSize: 13, color: D.textSecondary, padding: '40px 0' }}>Loading...</p>
              )}

              {!loadingTab2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* NIGHTY */}
                  {info.designMode === 'nighty' && nightyCuts.map(cut => (
                    <SectionBox key={cut.id} title={`Cut: ${cut.label}${info.cutRates?.[cut.label] ? ` · ₹${info.cutRates[cut.label]}/set` : ''}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        {cut.designs?.map(design => (
                          <div key={design.id} style={{ display: 'flex', gap: 12, backgroundColor: D.surface, padding: 12, borderRadius: 10, border: `1px solid ${D.borderLight}` }}>
                            <img src={design.photoUrl} alt="" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div>
                                <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>Design No</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>#{design.designNo}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>D.No</span>
                                <input
                                  type="text"
                                  value={design.dnNumber || ''}
                                  onChange={e => handleNightyDesignUpdate(cut.id, design.id, 'dnNumber', e.target.value)}
                                  style={{ width: '100%', padding: '6px 8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                                  placeholder="e.g. 1001"
                                />
                              </div>
                              <div>
                                <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, display: 'block', marginBottom: 3 }}>Sets</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={design.sets || 0}
                                  onChange={e => handleNightyDesignUpdate(cut.id, design.id, 'sets', Number(e.target.value))}
                                  style={{ width: '100%', padding: '6px 8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => handleNightyDesignDelete(cut.id, design.id, design.photoUrl)}
                              style={{ alignSelf: 'flex-start', background: '#fce8e6', border: 'none', color: D.error, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}
                            >Delete</button>
                          </div>
                        ))}
                      </div>
                      {/* FIX 4: multiple attribute added */}
                      <label style={{ display: 'block', border: `1.5px dashed ${D.border}`, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer', backgroundColor: D.surface }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: D.navy }}>
                          {uploadingTab2 ? 'Uploading...' : `+ Add Designs for ${cut.label}`}
                        </span>
                        <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={e => handleNightyDesignUpload(cut.id, e)} disabled={uploadingTab2} />
                      </label>
                    </SectionBox>
                  ))}

                  {/* DESIGN WISE */}
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
                                <input
                                  type="text"
                                  value={design.dnNumber || ''}
                                  onChange={e => handleSelectionDesignUpdate(design.id, 'dnNumber', e.target.value)}
                                  style={{ width: '100%', padding: '8px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                                  placeholder="e.g. 1001"
                                />
                              </div>
                              <span style={{ fontSize: 11, color: D.navy, fontWeight: 700, display: 'block', marginBottom: 6 }}>Stock</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {info.isStitched
                                  ? info.sizes?.map(size => (
                                      <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>{size}</span>
                                        <input
                                          type="number" min="0"
                                          value={design.stock?.[size] || 0}
                                          onChange={e => handleSelectionDesignUpdate(design.id, size, e.target.value, true)}
                                          style={{ width: 44, padding: '4px', border: `1px solid ${D.border}`, borderRadius: 4, textAlign: 'center', fontSize: 12 }}
                                        />
                                      </div>
                                    ))
                                  : (
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>Sets</span>
                                        <input
                                          type="number" min="0"
                                          value={design.stock?.sets || 0}
                                          onChange={e => handleSelectionDesignUpdate(design.id, 'sets', e.target.value, true)}
                                          style={{ width: 80, padding: '6px', border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 12 }}
                                        />
                                      </div>
                                    )
                                }
                              </div>
                            </div>
                            <button
                              onClick={() => handleSelectionDesignDelete(design.id, design.photoUrl)}
                              style={{ alignSelf: 'flex-start', background: '#fce8e6', border: 'none', color: D.error, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}
                            >Delete</button>
                          </div>
                        ))}
                      </div>
                      {/* FIX 4: multiple files */}
                      <label style={{ display: 'block', backgroundColor: D.navy, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                          {uploadingTab2 ? 'Uploading...' : '+ Add Designs'}
                        </span>
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
                            <div key={idx} style={{ backgroundColor: D.surface, padding: 8, borderRadius: 8, border: `1px solid ${D.borderLight}` }}>
                              <img src={img.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                              {info.designMode === 'fullset' && (
                                <input
                                  type="text" placeholder="D.No"
                                  value={img.dnNumber || ''}
                                  onChange={e => handleMainPhotoUpdate(idx, e.target.value)}
                                  style={{ width: '100%', padding: '6px', border: `1px solid ${D.border}`, borderRadius: 4, fontSize: 11, boxSizing: 'border-box', marginBottom: 8 }}
                                />
                              )}
                              <button
                                onClick={() => handleMainPhotoDelete(idx, img.url)}
                                style={{ width: '100%', padding: '6px', backgroundColor: '#fce8e6', color: D.error, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >Remove</button>
                            </div>
                          ))}
                        </div>
                        {/* FIX 4: multiple photos upload */}
                        <label style={{ display: 'block', backgroundColor: D.navy, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: uploadingTab2 ? 'not-allowed' : 'pointer' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                            {uploadingTab2 ? 'Uploading...' : '+ Upload Photo(s)'}
                          </span>
                          <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={handleMainPhotoUpload} disabled={uploadingTab2} />
                        </label>
                      </SectionBox>

                      {/* FIX: Fullset stock with explicit Save button */}
                      {info.designMode === 'fullset' && pendingStock !== null && (
                        <SectionBox title="Overall Stock">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                            {info.isStitched
                              ? info.sizes?.map(size => (
                                  <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: D.navy, marginBottom: 4 }}>{size}</span>
                                    <input
                                      type="number" min="0"
                                      value={pendingStock[size] ?? 0}
                                      onChange={e => handleFullsetStockLocalChange(size, e.target.value)}
                                      style={{ width: 60, padding: '8px', border: `1px solid ${D.border}`, borderRadius: 6, textAlign: 'center', fontSize: 14, fontWeight: 700 }}
                                    />
                                  </div>
                                ))
                              : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <input
                                      type="number" min="0"
                                      value={pendingStock.sets ?? 0}
                                      onChange={e => handleFullsetStockLocalChange('sets', e.target.value)}
                                      style={{ width: 120, padding: '10px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 16, fontWeight: 700, color: D.navy, outline: 'none' }}
                                    />
                                    <span style={{ fontSize: 14, color: D.textSecondary }}>Total Sets</span>
                                  </div>
                                )
                            }
                          </div>
                          {/* FIX: Save button for stock */}
                          <button
                            onClick={handleSaveFullsetStock}
                            disabled={savingStock}
                            style={{ width: '100%', padding: '12px', backgroundColor: savingStock ? D.border : D.success, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: savingStock ? 'not-allowed' : 'pointer' }}
                          >
                            {savingStock ? 'Saving Stock...' : 'Save Stock ✓'}
                          </button>
                        </SectionBox>
                      )}
                    </>
                  )}

                  {uploadingTab2 && (
                    <p style={{ textAlign: 'center', fontSize: 12, color: D.warning, padding: '8px 0' }}>⏳ Processing upload...</p>
                  )}

                  <p style={{ textAlign: 'center', fontSize: 11, color: D.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                    * Design changes (add/delete/edit) are saved immediately.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ── OrderCard ────────────────────────────────────────────────
function OrderCard({ order, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [actioning, setActioning] = useState(false);
  const shipments = order.shipments || [];
  const ss = statusStyle(order.status);

  const fmtQty = item => {
    if (item.sets) return `${item.sets} sets`;
    return `${item.orderedQty || item.quantity || 0} ${(item.unit || 'pc').replace('pieces', 'pcs').replace('piece', 'pc')}`;
  };

  return (
    <>
      {showDispatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDispatch(false)}>
          <div style={{ backgroundColor: D.surface, borderRadius: 16, padding: '16px 20px 28px', width: '90%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700, color: D.navy }}>Dispatch Details</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${D.borderLight}` }}>
              <span style={{ fontSize: 13, color: D.textSecondary }}>Order ID</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>#{order.id.slice(0, 8)}</span>
            </div>
            {shipments.map((ship, idx) => (
              <div key={idx} style={{ marginTop: 14, paddingBottom: 4, borderBottom: idx < shipments.length - 1 ? `2px solid ${D.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 18, backgroundColor: D.gold, borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: D.navy }}>Dispatch {idx + 1}{ship.billDate ? ` · ${ship.billDate}` : ''}</span>
                </div>
                {[['Bill No', ship.billNo], ['Transport', ship.transport], ['LR No', ship.lrNo], ['LR Date', ship.lrDate]]
                  .filter(([, v]) => v).map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                      <span style={{ fontSize: 13, color: D.textSecondary }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                {ship.items?.length > 0 && (
                  <div style={{ marginTop: 8, backgroundColor: D.bg, borderRadius: 8, padding: '8px 10px' }}>
                    {ship.items.map((item, iIdx) => (
                      <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                        <span style={{ fontSize: 12, color: D.textPrimary }}>{item.productName}{item.size ? ` (${item.size})` : ''}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>{item.qty} {item.unit || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setShowDispatch(false)}
              style={{ display: 'block', width: '100%', padding: '13px', marginTop: 20, backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: D.surface, borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 6px rgba(3,22,50,0.07)', border: `1px solid ${D.borderLight}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>#{order.id.slice(0, 8)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, backgroundColor: ss.bg, color: ss.color }}>{order.status || 'Pending'}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: D.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.buyerFirm} · {order.items?.length || 0} items</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: D.textSecondary }}>{order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {order.status === 'Pending' && (
          <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
            <button disabled={actioning} onClick={async () => { setActioning(true); await onApprove(order); setActioning(false); }}
              style={{ flex: 1, padding: '9px', backgroundColor: D.success, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✓ Approve</button>
            <button disabled={actioning} onClick={async () => { setActioning(true); await onReject(order); setActioning(false); }}
              style={{ flex: 1, padding: '9px', backgroundColor: '#fce8e6', color: D.error, border: `1px solid ${D.error}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕ Reject</button>
          </div>
        )}

        {expanded && (
          <div style={{ padding: '0 14px 10px', display: 'flex', gap: 8 }}>
            <button onClick={() => exportOrderPDF(order)}
              style={{ padding: '7px 14px', backgroundColor: D.navyMid, color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📄 Export PDF</button>
            {shipments.length > 0 && (
              <button onClick={() => setShowDispatch(true)}
                style={{ padding: '7px 14px', backgroundColor: '#e8edf5', color: D.navy, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📦 Dispatch Details</button>
            )}
          </div>
        )}

        {expanded && (
          <div style={{ borderTop: `1px solid ${D.borderLight}`, padding: '10px 14px 14px', backgroundColor: '#fafbfc' }}>
            {order.items?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                {item.photoUrl && <img src={item.photoUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{item.productName}</span>
                  {item.designNo && <span style={{ fontSize: 11, color: D.textSecondary }}> · DN{item.designNo}</span>}
                  {item.size && <span style={{ fontSize: 11, color: D.textSecondary }}> · Size {item.size}</span>}
                </div>
                <span style={{ fontSize: 11, color: D.textSecondary, flexShrink: 0, fontWeight: 600 }}>{fmtQty(item)}</span>
              </div>
            ))}
            {order.nightyDetails && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: D.textSecondary }}>
                {order.nightyDetails.totalSets} sets · {order.nightyDetails.packingType} sets/bale · <b style={{ color: D.navy }}>{order.nightyDetails.totalBales} bale(s)</b>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── SideNav ──────────────────────────────────────────────────
function SideNav({ activeTab, setActiveTab, pendingCount, onLogout, onAddProduct, isTablet, userProfile }) {
  const navWidth = isTablet ? 200 : 240;
  const tabs = [
    { id: 'products', label: 'Inventory', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'orders', label: 'Orders', badge: pendingCount, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  ];
  return (
    <div style={{ width: navWidth, flexShrink: 0, backgroundColor: D.navy, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, boxShadow: '2px 0 12px rgba(3,22,50,0.15)' }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
        <span style={{ fontSize: 10, color: D.goldLight, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Jain Agency</span>
        <span style={{ fontSize: isTablet ? 14 : 16, fontWeight: 800, color: 'white', display: 'block' }}>Supplier Panel</span>
        {userProfile?.firmName && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'block', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile.firmName}</span>}
      </div>
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isTablet ? '10px 12px' : '11px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: isActive ? 'white' : 'rgba(255,255,255,0.55)', fontSize: isTablet ? 13 : 14, fontWeight: isActive ? 700 : 500, textAlign: 'left' }}>
              {isActive && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, backgroundColor: D.goldLight, borderRadius: '0 2px 2px 0' }} />}
              {React.cloneElement(tab.icon, { stroke: isActive ? 'white' : 'rgba(255,255,255,0.55)', strokeWidth: isActive ? 2.5 : 1.8 })}
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.badge > 0 && <span style={{ backgroundColor: D.error, color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px' }}>{tab.badge}</span>}
            </button>
          );
        })}
        <button onClick={onAddProduct} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isTablet ? '10px 12px' : '11px 14px', borderRadius: 8, border: `1px solid rgba(119,90,25,0.4)`, cursor: 'pointer', marginTop: 8, backgroundColor: 'rgba(119,90,25,0.15)', color: D.goldLight, fontSize: isTablet ? 13 : 14, fontWeight: 700, textAlign: 'left' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.goldLight} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Product
        </button>
      </nav>
      <div style={{ padding: '12px 8px', borderTop: `1px solid rgba(255,255,255,0.08)` }}>
        <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          Logout
        </button>
      </div>
    </div>
  );
}

// ── BottomNav ────────────────────────────────────────────────
function BottomNav({ activeTab, setActiveTab, pendingCount }) {
  const tabs = [
    { id: 'products', label: 'Inventory', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'orders', label: 'Orders', badge: pendingCount, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, width: '100%', display: 'flex', backgroundColor: D.surface, borderTop: `1px solid ${D.borderLight}`, zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: 56, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              {React.cloneElement(tab.icon, { stroke: isActive ? D.navy : D.textSecondary, strokeWidth: isActive ? 2.5 : 1.8 })}
              {tab.badge > 0 && <span style={{ position: 'absolute', top: -6, right: -8, backgroundColor: D.error, color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 20, padding: '1px 5px', minWidth: 14, textAlign: 'center' }}>{tab.badge}</span>}
            </div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, marginTop: 2, color: isActive ? D.navy : D.textSecondary }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── SupplierDashboard ────────────────────────────────────────
function SupplierDashboard() {
  const { isMobile, isTablet } = useWindowSize();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const supplierId = auth.currentUser?.uid;
  const useSideNav = !isMobile;

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => { if (user) fetchAll(user.uid); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!supplierId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', supplierId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [supplierId]);

  useEffect(() => {
    const handleClickOutside = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAll = async (uid) => {
    await Promise.all([fetchProducts(uid), fetchCategories(), fetchOrders(uid), fetchProfile(uid)]);
  };

  const fetchProfile = async (uid) => {
    if (!uid) return;
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) setUserProfile(snap.data());
  };

  const fetchProducts = async (uid) => {
    if (!uid) return;
    const q = query(collection(db, 'products'), where('supplierId', '==', uid));
    const snap = await getDocs(q);
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchCategories = async () => {
    const snap = await getDocs(collection(db, 'categories'));
    setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchOrders = async (uid) => {
    if (!uid) return;
    const q = query(collection(db, 'orders'), where('supplierId', '==', uid));
    const snap = await getDocs(q);
    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  const handleApprove = async (order) => {
    await updateDoc(doc(db, 'orders', order.id), { status: 'Processing' });
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'Processing' } : o));
  };

  const handleReject = async (order) => {
    if (!window.confirm('Reject this order? Stock will be restored.')) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', order.id), { status: 'Cancelled' });
      for (const item of (order.items || [])) {
        if (item.designId && item.sets) {
          const dRef = doc(db, 'products', item.productId, 'designs', item.designId);
          const dSnap = await getDoc(dRef);
          if (dSnap.exists()) batch.update(dRef, { sets: (dSnap.data().sets || 0) + item.sets });
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) batch.update(pRef, { totalSets: (pSnap.data().totalSets || 0) + item.sets });
        }
      }
      await batch.commit();
      setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'Cancelled' } : o));
    } catch (err) { console.error('Reject error', err); }
  };

  const productGridCols = isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)';
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const handleLogout = () => { if (window.confirm('Logout?')) signOut(auth).then(() => navigate('/')); };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: D.bg, fontFamily: "'Inter', sans-serif" }}>
      {showAdd && <AddProductWizard categories={categories} onDone={(rc) => { setShowAdd(false); fetchProducts(supplierId); if (rc) fetchCategories(); }} onCancel={() => setShowAdd(false)} />}
      
      {/* FIX 2: Added shouldClose to onSaved so modal doesn't close on every Tab 2 update */}
      {editingProduct && (
        <EditProductModal 
          product={editingProduct} 
          onClose={() => setEditingProduct(null)} 
          onSaved={(updated, shouldClose = true) => { 
            setProducts(products.map(p => p.id === updated.id ? updated : p)); 
            if (shouldClose) setEditingProduct(null); 
          }} 
        />
      )}

      {useSideNav && <SideNav activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={pendingCount} onLogout={handleLogout} onAddProduct={() => setShowAdd(true)} isTablet={isTablet} userProfile={userProfile} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, flexShrink: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {isMobile && <span style={{ fontSize: 10, color: D.gold, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>}
            <span style={{ fontSize: 16, fontWeight: 700, color: D.navy }}>{activeTab === 'products' ? 'Inventory' : 'Orders'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && activeTab === 'products' && (
              <button onClick={() => setShowAdd(true)} style={{ padding: '7px 14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add</button>
            )}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}
                style={{ width: 40, height: 40, borderRadius: 20, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', backgroundColor: D.error }} />}
              </button>
              {showNotifications && (
                <div style={{ position: 'absolute', top: 48, right: 0, width: 290, backgroundColor: D.surface, borderRadius: 12, boxShadow: '0 8px 24px rgba(3,22,50,0.12)', zIndex: 100, overflow: 'hidden', border: `1px solid ${D.borderLight}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${D.borderLight}`, backgroundColor: D.bg }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: D.navy }}>Notifications</span>
                    <span style={{ fontSize: 12, color: D.textSecondary }}>{notifications.length} total</span>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: D.textSecondary, fontSize: 13 }}>No notifications</div>
                  ) : (
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {notifications.slice(0, 20).map(n => (
                        <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${D.borderLight}`, backgroundColor: n.read ? D.surface : '#f0f4ff' }}>
                          <span style={{ fontSize: 16, marginRight: 10 }}>{n.type === 'new_order' ? '🛒' : '🔔'}</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, color: D.textPrimary, lineHeight: 1.4 }}>{n.message}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 11, color: D.textSecondary }}>{n.createdAt?.toDate?.()?.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: D.navy, flexShrink: 0, marginTop: 4 }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={handleLogout} title="Logout" style={{ width: 40, height: 40, borderRadius: 20, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 80 : 20 }}>

          {activeTab === 'products' && (
            products.length === 0 ? (
              <div style={{ padding: '80px 16px', textAlign: 'center' }}>
                <p style={{ color: D.textPrimary, fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>No products yet</p>
                <p style={{ color: D.textSecondary, fontSize: 13, margin: '0 0 20px' }}>Add your first product to get started</p>
                <button onClick={() => setShowAdd(true)} style={{ padding: '12px 28px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add Product</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: productGridCols, gap: 16, padding: 16 }}>
                {products.map(p => {
                  const isApproved = p.status === 'approved';
                  const width = p.width;
                  return (
                    <div key={p.id} style={{ backgroundColor: D.surface, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(3,22,50,0.06)', border: `1px solid ${D.borderLight}` }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', backgroundColor: D.bg }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={D.border} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </div>
                        )}
                        <div style={{ position: 'absolute', top: 8, right: 8, backgroundColor: isApproved ? '#e6f4ea' : '#fef7e0', color: isApproved ? D.success : D.warning, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                          {isApproved ? '✓ Live' : '⏳ Pending'}
                        </div>
                        {/* Edit button */}
                        <button onClick={() => setEditingProduct(p)}
                          style={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 8, border: 'none', backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                      <div style={{ padding: '10px 12px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: D.gold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.category || p.categoryName}</span>
                        <p style={{ margin: '3px 0 2px', fontSize: 13, fontWeight: 700, color: D.textPrimary, lineHeight: 1.3 }}>{p.name}</p>
                        {width && <p style={{ margin: '0 0 2px', fontSize: 11, color: D.textSecondary, fontWeight: 600 }}>Width: {width}</p>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          {p.isNighty && p.cutRates ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>
                              {Object.entries(p.cutRates).map(([cut, rate]) => `${cut}: ₹${rate}`).join(' · ')}
                            </span>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 700, color: D.navy }}>₹{p.price}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: D.textSecondary }}>{p.moq} {p.unit} MOQ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'orders' && (
            <div style={{ padding: '8px 16px' }}>
              {pendingCount > 0 && (
                <div style={{ backgroundColor: '#fff3e0', border: `1px solid #f59e0b`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>⏳</span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: D.warning }}>{pendingCount} order{pendingCount > 1 ? 's' : ''} waiting for approval</p>
                </div>
              )}
              {orders.length === 0 ? (
                <div style={{ padding: '80px 0', textAlign: 'center', color: D.textSecondary }}><p style={{ fontSize: 15 }}>No orders yet</p></div>
              ) : (
                orders
                  .sort((a, b) => (a.status === 'Pending' ? -1 : b.status === 'Pending' ? 1 : 0))
                  .map(order => <OrderCard key={order.id} order={order} onApprove={handleApprove} onReject={handleReject} />)
              )}
            </div>
          )}
        </div>

        {isMobile && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={pendingCount} />}
      </div>
    </div>
  );
}

export default SupplierDashboard;