import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const D = { navy: '#031632', navyMid: '#1a2b48', textPrimary: '#191c1d', textSecondary: '#44474d', surface: '#ffffff', border: '#c5c6ce', borderLight: '#e7e8e9' };

function ProfileEdit({ userProfile, onSave, categories }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...userProfile, notificationPrefs: userProfile?.notificationPrefs || [] });
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
      notificationPrefs: form.notificationPrefs
    });
    setLoading(false); setEditing(false); onSave();
  };

  const toggleCategoryPref = (cat) => {
    setForm(prev => {
      const prefs = prev.notificationPrefs || [];
      if (prefs.includes(cat)) return { ...prev, notificationPrefs: prefs.filter(p => p !== cat) };
      return { ...prev, notificationPrefs: [...prefs, cat] };
    });
  };

  const S = {
    card: { backgroundColor: D.surface, borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(3,22,50,0.06)', textAlign: 'center', marginTop: 8 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${D.borderLight}`, textAlign: 'left' },
    input: { display: 'block', width: '100%', padding: '11px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, color: D.textPrimary, outline: 'none', boxSizing: 'border-box', marginBottom: 10, backgroundColor: D.surface },
    btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
    btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    chip: { flexShrink: 0, padding: '7px 14px', border: `1px solid ${D.border}`, borderRadius: 20, backgroundColor: D.surface, fontSize: 13, color: D.textSecondary, cursor: 'pointer' },
    chipActive: { flexShrink: 0, padding: '7px 14px', border: `1px solid ${D.navy}`, borderRadius: 20, backgroundColor: D.navy, fontSize: 13, color: 'white', cursor: 'pointer', fontWeight: 600 }
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

        <div style={{ marginTop: 20, textAlign: 'left' }}>
          <span style={{ fontSize: 12, color: D.textSecondary, fontWeight: 500 }}>Notification Preferences</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {userProfile.notificationPrefs?.length > 0 ? (
              userProfile.notificationPrefs.map(p => <span key={p} style={{ backgroundColor: D.navyMid, color: 'white', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{p}</span>)
            ) : (
              <span style={{ fontSize: 12, color: D.textSecondary }}>All Categories (Default)</span>
            )}
          </div>
        </div>

        <button style={{ ...S.btnPrimary, marginTop: 24 }} onClick={() => setEditing(true)}>Edit Profile</button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <h3 style={{ margin: '0 0 4px', color: D.textPrimary, textAlign: 'left' }}>Edit Profile</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: D.textSecondary, textAlign: 'left' }}>Press ESC to cancel</p>

      {[['firmName', 'Firm Name'], ['contactPerson', 'Contact Person'], ['mobile', 'Mobile'], ['address', 'Address'], ['city', 'City'], ['district', 'District'], ['state', 'State'], ['pincode', 'Pincode']].map(([key, placeholder]) => (
        <input key={key} style={S.input} value={form[key] || ''} placeholder={placeholder} onChange={e => setForm({ ...form, [key]: e.target.value })} />
      ))}

      <div style={{ marginTop: 16, marginBottom: 16, textAlign: 'left' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: D.navy, marginBottom: 8 }}>Product Notifications</p>
        <p style={{ fontSize: 11, color: D.textSecondary, marginBottom: 12 }}>Select categories you want updates for (Leave empty for all)</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map(cat => (
            <button key={cat} type="button" onClick={() => toggleCategoryPref(cat)} style={(form.notificationPrefs || []).includes(cat) ? S.chipActive : S.chip}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={S.btnPrimary} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        <button style={S.btnGhost} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}
export default ProfileEdit;