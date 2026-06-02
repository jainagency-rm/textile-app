import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { notifyNewUser } from '../utils/notifications';

const D = {
  navy: '#031632', navyMid: '#1a2b48', gold: '#775a19',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d',
  textSecondary: '#44474d', border: '#c5c6ce', error: '#ba1a1a', success: '#1a6b3c',
};

// ✅ Proper SVG eye icons
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

function SmartSelect({ label, value, onChange, options, placeholder, required }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes((search || value || '').toLowerCase()));

  const handleSelect = (opt) => { onChange(opt); setSearch(''); setOpen(false); };
  const handleInputChange = (e) => { onChange(e.target.value.toUpperCase()); setSearch(e.target.value.toUpperCase()); setOpen(true); };
  const handleBlur = () => setTimeout(() => setOpen(false), 150);

  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...S.input, backgroundColor: value ? '#f0f8f0' : D.bg, paddingRight: 32 }}
          value={value}
          onChange={handleInputChange}
          onFocus={() => { setSearch(''); setOpen(true); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: D.textSecondary, pointerEvents: 'none' }}>
          {open ? '▲' : '▼'}
        </span>
      </div>
      {open && options.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, backgroundColor: D.surface, border: `1.5px solid ${D.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(3,22,50,0.12)', maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 13, color: D.textSecondary }}>No match — type to use custom value</div>
          ) : filtered.map((opt, i) => (
            <div key={i} onMouseDown={() => handleSelect(opt)}
              style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: opt === value ? D.navy : D.textPrimary, fontWeight: opt === value ? 700 : 400, backgroundColor: opt === value ? '#e8edf5' : 'transparent', borderBottom: i < filtered.length - 1 ? `1px solid #e7e8e9` : 'none' }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Register() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'buyer';
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState('');
  const [postOffices, setPostOffices] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);

  const [formData, setFormData] = useState({
    gstNumber: '', firmName: '', contactPerson: '', mobile: '',
    addressLine1: '', addressLine2: '',
    pincode: '', city: '', district: '', state: '',
  });

  const handleFieldChange = (field, val) => setFormData(prev => ({ ...prev, [field]: val }));

  const fetchPincodeDetails = async (pin) => {
    setPincodeLoading(true);
    setPincodeError('');
    setCityOptions([]);
    setPostOffices([]);
    setFormData(prev => ({ ...prev, city: '', district: '', state: '' }));

    let offices = [];

    // Primary: api.postalpincode.in (direct)
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data[0]?.Status === 'Success') {
        offices = data[0].PostOffice || [];
      }
    } catch (_) {}

    // Fallback: allorigins proxy — bypasses CORS issues
    if (offices.length === 0) {
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.postalpincode.in/pincode/${pin}`)}`;
        const res2 = await fetch(proxyUrl);
        const wrapper = await res2.json();
        const data2 = JSON.parse(wrapper.contents);
        if (data2[0]?.Status === 'Success') {
          offices = data2[0].PostOffice || [];
        }
      } catch (_) {}
    }

    if (offices.length > 0) {
      setPostOffices(offices);
      const cities = [...new Set(offices.map(o => o.Block || o.Name).filter(Boolean))];
      setCityOptions(cities);
      const first = offices[0];
      setFormData(prev => ({
        ...prev,
        city: first.Block || first.Name || '',
        district: first.District || '',
        state: first.State || '',
      }));
      setPincodeError('');
    } else {
      setPincodeError('Pincode not found — enter details manually');
    }

    setPincodeLoading(false);
  };

  const handlePincodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, pincode: val, city: '', district: '', state: '' }));
    setPincodeError('');
    setCityOptions([]);
    setPostOffices([]);
    if (val.length === 6) fetchPincodeDetails(val);
  };

  const handleCityChange = (val) => {
    handleFieldChange('city', val);
    const match = postOffices.find(o => (o.Block || o.Name) === val);
    if (match) handleFieldChange('district', match.District || formData.district);
  };

  const districtOptions = [...new Set(postOffices.map(o => o.District).filter(Boolean))];
  const stateOptions = [...new Set(postOffices.map(o => o.State).filter(Boolean))];

  const handleStep1 = (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(''); setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      // ✅ Duplicate GST check
      if (formData.gstNumber.trim()) {
        const gstSnap = await getDocs(query(
          collection(db, 'users'),
          where('gstNumber', '==', formData.gstNumber.trim().toUpperCase())
        ));
        if (!gstSnap.empty) {
          setError('This GST number is already registered. Please login or use a different GST number.');
          setLoading(false);
          return;
        }
      }

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const address = [formData.addressLine1, formData.addressLine2].filter(Boolean).join(', ');
      await setDoc(doc(db, 'users', userCred.user.uid), {
        uid: userCred.user.uid, email, role, status: 'pending', createdAt: new Date(),
        gstNumber: formData.gstNumber.trim().toUpperCase(),
        firmName: formData.firmName.toUpperCase(),
        contactPerson: formData.contactPerson.toUpperCase(),
        mobile: '+91' + formData.mobile,
        address: address.toUpperCase(),
        city: formData.city.toUpperCase(),
        district: formData.district.toUpperCase(),
        state: formData.state.toUpperCase(),
        pincode: formData.pincode,
      });
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminId = adminSnap.docs[0]?.id;
      if (adminId) await notifyNewUser(adminId, formData.firmName, role);
      navigate('/pending');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email is already registered. Please login.');
      else if (!err.message?.includes('GST')) setError('Something went wrong. Try again.');
    }
    setLoading(false);
  };

  return (
    <div style={S.page}>
      <div style={S.bgPattern} />
      <div style={S.card}>

        <div style={S.logoArea}>
          <div style={S.logoMark}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill={D.gold}/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke={D.gold} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 style={S.brandName}>Jain Agency</h1>
            <p style={S.brandTagline}>Textile Marketplace</p>
          </div>
        </div>

        <div style={S.divider} />

        <div style={S.roleBadge}>
          <span style={{ fontSize: 16 }}>{role === 'buyer' ? '🛍️' : '🏭'}</span>
          <span>{role === 'buyer' ? 'Buyer' : 'Supplier'} Registration</span>
        </div>

        <div style={S.stepRow}>
          <div style={{ ...S.stepDot, backgroundColor: D.navy }}>
            {step > 1
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              : <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>1</span>}
          </div>
          <div style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: step > 1 ? D.navy : D.border }} />
          <div style={{ ...S.stepDot, backgroundColor: step >= 2 ? D.navy : D.border }}>
            <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>2</span>
          </div>
          <div style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: D.border }} />
          <div style={{ ...S.stepDot, backgroundColor: D.border }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
        </div>
        <div style={S.stepLabels}>
          <span style={S.stepLabel}>Account</span>
          <span style={S.stepLabel}>Business</span>
          <span style={S.stepLabel}>Done</span>
        </div>

        {step === 1 && (
          <div>
            <h2 style={S.formTitle}>Create Account</h2>
            <p style={S.formSubtitle}>Start with your login credentials</p>
            <form onSubmit={handleStep1}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Email Address</label>
                <input style={S.input} type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Password</label>
                <div style={S.passWrap}>
                  <input
                    style={{ ...S.input, paddingRight: 44 }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" style={S.eyeBtn} onClick={() => setShowPass(!showPass)} title={showPass ? 'Hide password' : 'Show password'}>
                    <span style={{ color: D.textSecondary, display: 'flex', alignItems: 'center' }}>
                      {showPass ? <EyeOffIcon /> : <EyeIcon />}
                    </span>
                  </button>
                </div>
              </div>
              {error && <p style={S.errorMsg}>{error}</p>}
              <button style={S.primaryBtn} type="submit">Continue →</button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              <p style={{ ...S.loginText, margin: 0 }}>Already registered? <Link to="/" style={S.linkText}>Sign in</Link></p>
              <Link to="/" style={{ textAlign: 'center', fontSize: 13, color: D.textSecondary, textDecoration: 'none', display: 'block' }}>← Back to Login</Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={S.formTitle}>Business Details</h2>
            <p style={S.formSubtitle}>Helps us verify your account</p>
            <form onSubmit={handleSubmit}>
              <div style={{ maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 }}>

                <div style={S.fieldGroup}>
                  <label style={S.label}>GST Number</label>
                  <input
                    style={S.input} name="gstNumber"
                    placeholder="22AAAAA0000A1Z5"
                    value={formData.gstNumber}
                    onChange={e => setFormData(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) }))}
                    required
                  />
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Firm Name</label>
                  <input style={S.input} name="firmName" placeholder="e.g. SHREE TEXTILES"
                    value={formData.firmName} onChange={e => setFormData(prev => ({ ...prev, firmName: e.target.value.toUpperCase() }))} required />
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Contact Person</label>
                  <input style={S.input} name="contactPerson" placeholder="FULL NAME"
                    value={formData.contactPerson} onChange={e => setFormData(prev => ({ ...prev, contactPerson: e.target.value.toUpperCase() }))} required />
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Mobile Number</label>
                  <div style={{ display: 'flex' }}>
                    <div style={{ padding: '11px 13px', border: '1.5px solid #c5c6ce', borderRight: 'none', borderRadius: '8px 0 0 8px', backgroundColor: '#f8f9fa', fontSize: 14, color: '#44474d', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center' }}>+91</div>
                    <input
                      style={{ ...S.input, borderRadius: '0 8px 8px 0', borderLeft: 'none', flex: 1 }}
                      name="mobile" placeholder="10-digit number" type="tel" maxLength={10}
                      value={formData.mobile}
                      onChange={e => setFormData(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      required
                    />
                  </div>
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Address Line 1</label>
                  <input style={S.input} name="addressLine1" placeholder="SHOP / BUILDING / STREET"
                    value={formData.addressLine1} onChange={e => setFormData(prev => ({ ...prev, addressLine1: e.target.value.toUpperCase() }))} required />
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Address Line 2 <span style={{ color: D.textSecondary, fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <input style={S.input} name="addressLine2" placeholder="AREA / LANDMARK"
                    value={formData.addressLine2} onChange={e => setFormData(prev => ({ ...prev, addressLine2: e.target.value.toUpperCase() }))} />
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>
                    Pincode
                    {pincodeLoading && <span style={{ marginLeft: 8, fontSize: 11, color: D.gold, fontWeight: 600, textTransform: 'none' }}>⏳ Fetching...</span>}
                    {!pincodeLoading && formData.city && !pincodeError && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: D.success, fontWeight: 600, textTransform: 'none' }}>✓ Details loaded</span>
                    )}
                  </label>
                  <input
                    style={{ ...S.input, letterSpacing: formData.pincode ? '0.1em' : 'normal' }}
                    placeholder="6-digit pincode" type="tel"
                    value={formData.pincode} onChange={handlePincodeChange} maxLength={6} required
                  />
                  {pincodeError && <p style={{ margin: '5px 0 0', fontSize: 12, color: D.error }}>⚠ {pincodeError}</p>}
                </div>

                <SmartSelect
                  label="City / Block"
                  value={formData.city}
                  onChange={val => handleCityChange(val.toUpperCase())}
                  options={cityOptions}
                  placeholder={pincodeLoading ? '⏳ Fetching...' : 'Enter pincode first or type manually'}
                  required
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <SmartSelect
                    label="District"
                    value={formData.district}
                    onChange={val => handleFieldChange('district', val.toUpperCase())}
                    options={districtOptions}
                    placeholder="Type or select"
                    required
                  />
                  <SmartSelect
                    label="State"
                    value={formData.state}
                    onChange={val => handleFieldChange('state', val.toUpperCase())}
                    options={stateOptions}
                    placeholder="Type or select"
                    required
                  />
                </div>

              </div>

              {error && <p style={S.errorMsg}>{error}</p>}
              <button style={S.primaryBtn} type="submit" disabled={loading || pincodeLoading}>
                {loading ? 'Submitting...' : 'Submit for Approval ✓'}
              </button>
            </form>
            <button style={S.ghostBtn} type="button" onClick={() => { setStep(1); setError(''); }}>← Back</button>
          </div>
        )}

        <p style={S.footerText}>© 2026 Jain Agency · All rights reserved</p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: D.navy, padding: 20, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif" },
  bgPattern: { position: 'absolute', inset: 0, zIndex: 0, backgroundImage: `radial-gradient(circle at 20% 20%, rgba(119,90,25,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(26,43,72,0.8) 0%, transparent 50%)` },
  card: { position: 'relative', zIndex: 1, backgroundColor: D.surface, borderRadius: 20, padding: '28px 28px 20px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' },
  logoArea: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  logoMark: { width: 48, height: 48, borderRadius: 12, backgroundColor: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName: { margin: 0, fontSize: 20, fontWeight: 800, color: D.navy, letterSpacing: '-0.02em' },
  brandTagline: { margin: '2px 0 0', fontSize: 12, color: D.textSecondary, fontWeight: 500 },
  divider: { height: 1, backgroundColor: D.border, margin: '0 0 20px', opacity: 0.5 },
  roleBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: '#e8edf5', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: D.navy, marginBottom: 20 },
  stepRow: { display: 'flex', alignItems: 'center', marginBottom: 6 },
  stepDot: { width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepLabels: { display: 'flex', justifyContent: 'space-between', marginBottom: 20 },
  stepLabel: { fontSize: 10, color: D.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  formTitle: { margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: D.navy, letterSpacing: '-0.02em' },
  formSubtitle: { margin: '0 0 16px', fontSize: 13, color: D.textSecondary },
  fieldGroup: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: D.textSecondary, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { display: 'block', width: '100%', padding: '11px 13px', border: `1.5px solid ${D.border}`, borderRadius: 8, fontSize: 14, color: D.textPrimary, outline: 'none', boxSizing: 'border-box', backgroundColor: D.bg, fontFamily: 'inherit' },
  passWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { display: 'block', width: '100%', padding: '13px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 12, letterSpacing: '-0.01em', fontFamily: 'inherit' },
  ghostBtn: { display: 'block', width: '100%', padding: '11px', backgroundColor: 'transparent', color: D.textSecondary, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10, fontFamily: 'inherit' },
  errorMsg: { fontSize: 13, color: D.error, margin: '8px 0 0', fontWeight: 500 },
  loginText: { textAlign: 'center', fontSize: 13, color: D.textSecondary, marginTop: 18, marginBottom: 0 },
  linkText: { color: D.gold, textDecoration: 'none', fontWeight: 700 },
  footerText: { textAlign: 'center', fontSize: 11, color: D.border, marginTop: 20, marginBottom: 0 },
};

export default Register;