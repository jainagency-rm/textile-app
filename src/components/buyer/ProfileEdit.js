import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const D = { navy: '#031632', navyMid: '#1a2b48', textPrimary: '#191c1d', textSecondary: '#44474d', surface: '#ffffff', border: '#c5c6ce', borderLight: '#e7e8e9' };

function ProfileEdit({ userProfile, onSave, categories }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...userProfile });
  const [loading, setLoading] = useState(false);

  // FIX 1 — Pincode states
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [postOffices, setPostOffices] = useState([]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setEditing(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    await updateDoc(doc(db, 'users', userProfile.uid), {
      gstNumber: (form.gstNumber || '').toUpperCase(),
      firmName: form.firmName, contactPerson: form.contactPerson, mobile: form.mobile,
      address: form.address, city: form.city, district: form.district, state: form.state, pincode: form.pincode,
    });
    setLoading(false); setEditing(false); onSave();
  };

  // FIX 2 — Pincode fetch
  const fetchPincodeDetails = async (pin) => {
    setPincodeLoading(true);
    setPincodeError('');
    setCityOptions([]);
    setPostOffices([]);
    setForm(prev => ({ ...prev, city: '', district: '', state: '' }));

    let offices = [];
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data[0]?.Status === 'Success') offices = data[0].PostOffice || [];
    } catch (_) {}

    if (offices.length === 0) {
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.postalpincode.in/pincode/${pin}`)}`;
        const res2 = await fetch(proxyUrl);
        const wrapper = await res2.json();
        const data2 = JSON.parse(wrapper.contents);
        if (data2[0]?.Status === 'Success') offices = data2[0].PostOffice || [];
      } catch (_) {}
    }

    if (offices.length > 0) {
      setPostOffices(offices);
      const cities = [...new Set(offices.map(o => o.Block || o.Name).filter(Boolean))];
      setCityOptions(cities);
      const first = offices[0];
      setForm(prev => ({
        ...prev,
        city: (first.Block || first.Name || '').toUpperCase(),
        district: (first.District || '').toUpperCase(),
        state: (first.State || '').toUpperCase(),
      }));
      setPincodeError('');
    } else {
      setPincodeError('Pincode not found — enter details manually');
    }
    setPincodeLoading(false);
  };

  const handlePincodeChange = (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setForm(prev => ({ ...prev, pincode: clean, city: '', district: '', state: '' }));
    setPincodeError('');
    setCityOptions([]);
    setPostOffices([]);
    if (clean.length === 6) fetchPincodeDetails(clean);
  };

  const S = {
    card: { backgroundColor: D.surface, borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(3,22,50,0.06)', textAlign: 'center', marginTop: 8 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${D.borderLight}`, textAlign: 'left' },
    input: { display: 'block', width: '100%', padding: '11px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, color: D.textPrimary, outline: 'none', boxSizing: 'border-box', marginBottom: 10, backgroundColor: D.surface },
    label: { display: 'block', fontSize: 11, fontWeight: 600, color: D.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' },
    btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
    btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  };

  if (!editing) {
    return (
      <div style={S.card}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
          <span style={{ fontSize: 28, color: D.navy, fontWeight: 700 }}>{userProfile.firmName?.[0]?.toUpperCase()}</span>
        </div>
        <h3 style={{ margin: '12px 0 4px', color: D.textPrimary, fontSize: 18, fontWeight: 700 }}>{userProfile.firmName}</h3>
        <p style={{ margin: '0 0 20px', color: D.textSecondary, fontSize: 13 }}>{userProfile.email}</p>

        {[['GST Number', userProfile.gstNumber], ['Contact Person', userProfile.contactPerson], ['Mobile', userProfile.mobile], ['Address', userProfile.address], ['City', userProfile.city], ['District', userProfile.district], ['State', userProfile.state], ['Pincode', userProfile.pincode]].map(([label, val]) => (
          <div key={label} style={S.row}>
            <span style={{ fontSize: 12, color: D.textSecondary, fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 13, color: D.textPrimary, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{val || '—'}</span>
          </div>
        ))}

        <button style={{ ...S.btnPrimary, marginTop: 24 }} onClick={() => setEditing(true)}>Edit Profile</button>
      </div>
    );
  }

  // FIX 3 — Edit form with reordered fields
  return (
    <div style={S.card}>
      <h3 style={{ margin: '0 0 4px', color: D.textPrimary, textAlign: 'left' }}>Edit Profile</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: D.textSecondary, textAlign: 'left' }}>Press ESC to cancel</p>

      {/* 1. GST Number */}
      <label style={S.label}>GST Number</label>
      <input style={S.input} placeholder="22AAAAA0000A1Z5" value={form.gstNumber || ''} onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) })} />

      {/* 2. Firm Name */}
      <label style={S.label}>Firm Name</label>
      <input style={S.input} placeholder="FIRM NAME" value={form.firmName || ''} onChange={e => setForm({ ...form, firmName: e.target.value.toUpperCase() })} />

      {/* 3. Contact Person */}
      <label style={S.label}>Contact Person</label>
      <input style={S.input} placeholder="FULL NAME" value={form.contactPerson || ''} onChange={e => setForm({ ...form, contactPerson: e.target.value.toUpperCase() })} />

      {/* 4. Address */}
      <label style={S.label}>Address</label>
      <input style={S.input} placeholder="STREET / BUILDING" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value.toUpperCase() })} />

      {/* 5. Pincode with auto-fetch */}
      <label style={S.label}>
        Pincode
        {pincodeLoading && <span style={{ marginLeft: 8, fontSize: 11, color: '#775a19', fontWeight: 600, textTransform: 'none' }}>⏳ Fetching...</span>}
        {!pincodeLoading && form.city && !pincodeError && <span style={{ marginLeft: 8, fontSize: 11, color: '#1a6b3c', fontWeight: 600, textTransform: 'none' }}>✓ Loaded</span>}
      </label>
      <input
        style={S.input}
        placeholder="6-digit pincode"
        type="tel"
        maxLength={6}
        value={form.pincode || ''}
        onChange={e => handlePincodeChange(e.target.value)}
      />
      {pincodeError && <p style={{ fontSize: 11, color: '#ba1a1a', margin: '-6px 0 10px', textAlign: 'left' }}>{pincodeError}</p>}

      {/* 6. City */}
      <label style={S.label}>City</label>
      <input
        style={S.input}
        list="city-options-edit"
        placeholder="City"
        value={form.city || ''}
        onChange={e => setForm({ ...form, city: e.target.value.toUpperCase() })}
      />
      <datalist id="city-options-edit">
        {cityOptions.map(c => <option key={c} value={c.toUpperCase()} />)}
      </datalist>

      {/* 7. District */}
      <label style={S.label}>District</label>
      <input style={S.input} placeholder="District" value={form.district || ''} onChange={e => setForm({ ...form, district: e.target.value.toUpperCase() })} />

      {/* 8. State */}
      <label style={S.label}>State</label>
      <input style={S.input} placeholder="State" value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} />

      {/* 9. Mobile with +91 prefix */}
      <label style={S.label}>Mobile</label>
      <div style={{ display: 'flex', marginBottom: 10 }}>
        <div style={{ padding: '11px 13px', border: `1px solid ${D.border}`, borderRight: 'none', borderRadius: '8px 0 0 8px', backgroundColor: '#f8f9fa', fontSize: 14, color: D.textSecondary, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center' }}>+91</div>
        <input
          style={{ ...S.input, borderRadius: '0 8px 8px 0', borderLeft: 'none', marginBottom: 0 }}
          placeholder="10-digit number"
          type="tel"
          maxLength={10}
          value={(form.mobile || '').replace(/^\+91/, '')}
          onChange={e => setForm({ ...form, mobile: '+91' + e.target.value.replace(/\D/g, '').slice(0, 10) })}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={S.btnPrimary} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        <button style={S.btnGhost} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}
export default ProfileEdit;
