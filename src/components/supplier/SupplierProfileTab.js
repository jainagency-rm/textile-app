import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../../firebase';
import ProfileEdit from '../buyer/ProfileEdit';

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

export default function SupplierProfileTab({ userProfile, fetchProfile }) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setEditing(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!userProfile) return null;

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
      await fetchProfile(user.uid);
    } catch (err) { console.error('Avatar upload failed:', err); }
    setUploading(false);
  };

  const initial = userProfile.firmName?.[0]?.toUpperCase() || '?';

  if (editing) {
    return (
      <div style={{ padding: '0 16px 80px' }}>
        <ProfileEdit
          userProfile={userProfile}
          onSave={() => { fetchProfile(auth.currentUser?.uid); setEditing(false); }}
          onCancel={() => setEditing(false)}
          categories={[]}
        />
      </div>
    );
  }

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

        <button onClick={() => setEditing(true)} style={{ display: 'block', width: '100%', padding: '14px', backgroundColor: DC.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}>
          Edit Profile
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
