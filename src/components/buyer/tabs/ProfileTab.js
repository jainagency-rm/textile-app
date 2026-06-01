import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../../../firebase';

const DC = {
  navy: '#031632', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d',
  textSecondary: '#44474d', borderLight: '#e7e8e9', border: '#c5c6ce',
};

function InfoRow({ label, value }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: `1px solid ${DC.borderLight}` }}>
      <p style={{ margin: 0, fontSize: 11, color: DC.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: DC.navy }}>{value || '—'}</p>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ backgroundColor: DC.surface, borderRadius: 12, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(3,22,50,0.06)' }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: DC.navy, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</p>
      {children}
    </div>
  );
}

export default function ProfileTab({ userProfile, fetchProfile, categories, S, D }) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [form, setForm] = useState({});
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [postOffices, setPostOffices] = useState([]);
  const fileInputRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setEditing(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!userProfile) return null;

  const startEditing = () => {
    setForm({
      firmName: userProfile.firmName || '',
      contactPerson: userProfile.contactPerson || '',
      mobile: (userProfile.mobile || '').replace(/^\+91/, ''),
      address: userProfile.address || '',
      city: userProfile.city || '',
      district: userProfile.district || '',
      state: userProfile.state || '',
      pincode: userProfile.pincode || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    await updateDoc(doc(db, 'users', user.uid), {
      firmName: form.firmName,
      contactPerson: form.contactPerson,
      mobile: form.mobile ? '+91' + form.mobile.replace(/^\+91/, '') : userProfile.mobile,
      address: form.address,
      city: form.city,
      district: form.district,
      state: form.state,
      pincode: form.pincode,
    });
    await fetchProfile();
    setSaving(false);
    setEditing(false);
  };

  const fetchPincodeDetails = async (pin) => {
    setPincodeLoading(true); setPincodeError(''); setCityOptions([]); setPostOffices([]);
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
      setCityOptions([...new Set(offices.map(o => o.Block || o.Name).filter(Boolean))]);
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
    setPincodeError(''); setCityOptions([]); setPostOffices([]);
    if (clean.length === 6) fetchPincodeDetails(clean);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const user = auth.currentUser;
    if (!user) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      await fetchProfile();
    } catch (err) { console.error('Avatar upload failed:', err); }
    setUploading(false);
  };

  const notifPrefs = userProfile.notificationPrefs || [];

  const saveNotifPrefs = async (newPrefs) => {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { notificationPrefs: newPrefs });
    await fetchProfile();
  };

  const togglePref = async (cat) => {
    const newPrefs = notifPrefs.includes(cat)
      ? notifPrefs.filter(p => p !== cat)
      : [...notifPrefs, cat];
    await saveNotifPrefs(newPrefs);
  };

  const notifLabel = notifPrefs.length === 0
    ? 'All Categories'
    : notifPrefs.length <= 2
      ? notifPrefs.join(', ')
      : `${notifPrefs.slice(0, 2).join(', ')} +${notifPrefs.length - 2}`;

  const initial = userProfile.firmName?.[0]?.toUpperCase() || '?';
  const inputStyle = { display: 'block', width: '100%', padding: '11px 14px', border: `1px solid ${DC.border}`, borderRadius: 8, fontSize: 14, color: DC.textPrimary, outline: 'none', boxSizing: 'border-box', marginBottom: 10, backgroundColor: DC.surface };

  // ── EDIT MODE ──
  if (editing) {
    return (
      <div style={{ padding: '0 16px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 10px' }}>
          <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: DC.navy, padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: DC.navy }}>Edit Profile</span>
        </div>
        <div style={{ backgroundColor: DC.surface, borderRadius: 12, padding: '16px', boxShadow: '0 1px 4px rgba(3,22,50,0.06)' }}>
          {/* Firm Name */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Firm Name</label>
          <input style={inputStyle} placeholder="FIRM NAME" value={form.firmName || ''} onChange={e => setForm(prev => ({ ...prev, firmName: e.target.value.toUpperCase() }))} />

          {/* Contact Person */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Person</label>
          <input style={inputStyle} placeholder="FULL NAME" value={form.contactPerson || ''} onChange={e => setForm(prev => ({ ...prev, contactPerson: e.target.value.toUpperCase() }))} />

          {/* Address */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</label>
          <input style={inputStyle} placeholder="STREET / BUILDING" value={form.address || ''} onChange={e => setForm(prev => ({ ...prev, address: e.target.value.toUpperCase() }))} />

          {/* Pincode */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pincode
            {pincodeLoading && <span style={{ marginLeft: 8, fontSize: 11, color: DC.gold, fontWeight: 600, textTransform: 'none' }}>⏳ Fetching...</span>}
            {!pincodeLoading && form.city && !pincodeError && <span style={{ marginLeft: 8, fontSize: 11, color: '#1a6b3c', fontWeight: 600, textTransform: 'none' }}>✓ Loaded</span>}
          </label>
          <input style={inputStyle} placeholder="6-digit pincode" type="tel" maxLength={6} value={form.pincode || ''} onChange={e => handlePincodeChange(e.target.value)} />
          {pincodeError && <p style={{ fontSize: 11, color: '#ba1a1a', margin: '-6px 0 10px' }}>{pincodeError}</p>}

          {/* City */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>City</label>
          <input style={inputStyle} list="tab-city-options" placeholder="City" value={form.city || ''} onChange={e => setForm(prev => ({ ...prev, city: e.target.value.toUpperCase() }))} />
          <datalist id="tab-city-options">{cityOptions.map(c => <option key={c} value={c.toUpperCase()} />)}</datalist>

          {/* District */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>District</label>
          <input style={inputStyle} placeholder="District" value={form.district || ''} onChange={e => setForm(prev => ({ ...prev, district: e.target.value.toUpperCase() }))} />

          {/* State */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>State</label>
          <input style={inputStyle} placeholder="State" value={form.state || ''} onChange={e => setForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))} />

          {/* Mobile */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: DC.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mobile</label>
          <div style={{ display: 'flex', marginBottom: 10 }}>
            <div style={{ padding: '11px 13px', border: `1px solid ${DC.border}`, borderRight: 'none', borderRadius: '8px 0 0 8px', backgroundColor: DC.bg, fontSize: 14, color: DC.textSecondary, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center' }}>+91</div>
            <input style={{ ...inputStyle, borderRadius: '0 8px 8px 0', borderLeft: 'none', marginBottom: 0 }} placeholder="10-digit number" type="tel" maxLength={10} value={form.mobile || ''} onChange={e => setForm(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button style={{ flex: 1, padding: '14px', backgroundColor: DC.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button style={{ flex: 1, padding: '13px', backgroundColor: 'transparent', color: DC.navy, border: `1.5px solid ${DC.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW MODE ──
  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${DC.navy} 0%, #1a2b48 100%)`, padding: '28px 16px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.2)', backgroundColor: '#1a2b48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uploading ? (
              <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : userProfile.photoURL ? (
              <img src={userProfile.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 28, fontWeight: 800, color: 'white' }}>{initial}</span>
            )}
          </div>
          <button onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', backgroundColor: DC.goldLight, border: '2px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DC.navy} strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>{userProfile.firmName}</p>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{userProfile.email || auth.currentUser?.email}</p>
          {(userProfile.city || userProfile.state) && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: DC.goldLight, fontWeight: 600 }}>{[userProfile.city, userProfile.state].filter(Boolean).join(', ')}</p>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>

        <SectionCard title="Business Details">
          <InfoRow label="GST Number" value={userProfile.gstNumber} />
          <InfoRow label="Contact Person" value={userProfile.contactPerson} />
          <InfoRow label="Mobile" value={userProfile.mobile} />
        </SectionCard>

        <SectionCard title="Address">
          <InfoRow label="Address" value={userProfile.address} />
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${DC.borderLight}` }}>
            <p style={{ margin: 0, fontSize: 11, color: DC.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>City & District</p>
            <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: DC.navy }}>{[userProfile.city, userProfile.district].filter(Boolean).join(', ') || '—'}</p>
          </div>
          <div style={{ padding: '10px 0' }}>
            <p style={{ margin: 0, fontSize: 11, color: DC.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>State & Pincode</p>
            <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: DC.navy }}>{[userProfile.state, userProfile.pincode].filter(Boolean).join(' — ') || '—'}</p>
          </div>
        </SectionCard>

        <SectionCard title="🔔 Notifications">
          <p style={{ margin: '0 0 8px', fontSize: 12, color: DC.textSecondary }}>You receive alerts for these categories</p>
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(o => !o)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #c5c6ce', borderRadius: 8, backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: DC.navy }}>
              <span>🔔 {notifLabel}</span>
              <span style={{ fontSize: 10 }}>{notifOpen ? '▲' : '▾'}</span>
            </button>
            {notifOpen && (
              <div style={{ position: 'absolute', width: '100%', backgroundColor: 'white', border: '1px solid #c5c6ce', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #e7e8e9' }}>
                  <button onClick={() => saveNotifPrefs(categories)} style={{ flex: 1, padding: '8px', border: 'none', backgroundColor: 'transparent', color: DC.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRight: '1px solid #e7e8e9' }}>Select All</button>
                  <button onClick={() => saveNotifPrefs([])} style={{ flex: 1, padding: '8px', border: 'none', backgroundColor: 'transparent', color: '#ba1a1a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Clear All</button>
                </div>
                {categories.map(cat => {
                  const checked = notifPrefs.includes(cat);
                  return (
                    <div key={cat} onClick={() => togglePref(cat)} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e7e8e9', cursor: 'pointer', backgroundColor: checked ? '#f0f4ff' : 'white' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? DC.navy : '#c5c6ce'}`, backgroundColor: checked ? DC.navy : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: DC.navy }}>{cat}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>

        <button onClick={startEditing} style={{ display: 'block', width: '100%', padding: '14px', backgroundColor: DC.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}>
          Edit Profile
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
