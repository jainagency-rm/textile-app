import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const D = {
  navy: '#031632',
  navyMid: '#1a2b48',
  gold: '#775a19',
  goldLight: '#c49a2e',
  bg: '#f8f9fa',
  surface: '#ffffff',
  textPrimary: '#191c1d',
  textSecondary: '#44474d',
  border: '#c5c6ce',
  error: '#ba1a1a',
  success: '#1a6b3c',
};

function Login() {
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const ud = userDoc.data();
            if (ud.role === 'admin') navigate('/admin');
            else if (ud.status === 'pending') navigate('/pending');
            else if (ud.role === 'buyer') navigate('/buyer');
            else if (ud.role === 'supplier') navigate('/supplier');
          }
        } catch (err) { console.error(err); }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!role) { setError('Please select Buyer or Supplier'); return; }
    setLoading(true); setError('');
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      if (!userDoc.exists()) { setError('User not found'); setLoading(false); return; }
      const ud = userDoc.data();
      if (ud.role === 'admin') { navigate('/admin'); return; }
      if (ud.role !== role) { setError('Invalid role selected'); setLoading(false); return; }
      if (ud.status === 'pending') { navigate('/pending'); return; }
      if (ud.role === 'buyer') navigate('/buyer');
      else if (ud.role === 'supplier') navigate('/supplier');
    } catch (err) { setError('Invalid email or password'); }
    setLoading(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      if (!userDoc.exists()) { setError('User not found'); setLoading(false); return; }
      const ud = userDoc.data();
      if (ud.role !== 'admin') { setError('Not an admin account'); setLoading(false); return; }
      navigate('/admin');
    } catch (err) { setError('Invalid email or password'); }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMsg(''); setError('');
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotMsg('Reset link sent! Check your email.');
    } catch (err) { setError('Email not found. Check and try again.'); }
  };

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center' }}>
          <div style={S.spinner} />
          <p style={{ color: D.textSecondary, fontSize: 14, marginTop: 16 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Background pattern */}
      <div style={S.bgPattern} />

      <div style={S.card}>
        {/* Logo area */}
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
          <button style={S.menuBtn} title="Admin" onClick={() => { setShowAdmin(!showAdmin); setShowForgot(false); setRole(''); setError(''); setEmail(''); setPassword(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          </button>
        </div>

        {/* Divider */}
        <div style={S.divider} />

        {showForgot ? (
          /* Forgot Password */
          <div>
            <h2 style={S.formTitle}>Reset Password</h2>
            <p style={S.formSubtitle}>Enter your email to receive a reset link</p>
            <form onSubmit={handleForgotPassword}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Email Address</label>
                <input style={S.input} type="email" placeholder="your@email.com"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
              </div>
              {error && <p style={S.errorMsg}>{error}</p>}
              {forgotMsg && <p style={S.successMsg}>✓ {forgotMsg}</p>}
              <button style={S.primaryBtn} type="submit">Send Reset Link</button>
              <button style={S.ghostBtn} type="button" onClick={() => { setShowForgot(false); setError(''); setForgotMsg(''); }}>
                ← Back to Login
              </button>
            </form>
          </div>

        ) : showAdmin ? (
          /* Admin Login */
          <div>
            <div style={S.adminBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Admin Access</span>
            </div>
            <h2 style={S.formTitle}>Admin Login</h2>
            <p style={S.formSubtitle}>Restricted to administrators only</p>
            <form onSubmit={handleAdminLogin}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Admin Email</label>
                <input style={S.input} type="email" placeholder="admin@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Password</label>
                <div style={S.passWrap}>
                  <input style={{ ...S.input, paddingRight: 44 }} type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" style={S.eyeBtn} onClick={() => setShowPass(!showPass)}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {error && <p style={S.errorMsg}>{error}</p>}
              <button style={{ ...S.primaryBtn, backgroundColor: D.navyMid }} type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In as Admin'}
              </button>
              <button style={S.ghostBtn} type="button" onClick={() => { setShowAdmin(false); setError(''); }}>
                ← Back
              </button>
            </form>
          </div>

        ) : (
          /* Main Login */
          <div>
            <h2 style={S.formTitle}>Welcome back</h2>
            <p style={S.formSubtitle}>Sign in to your account</p>

            {/* Role selector */}
            <div style={S.roleRow}>
              <button style={role === 'buyer' ? S.roleActive : S.roleBtn} onClick={() => { setRole('buyer'); setError(''); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                Buyer
              </button>
              <button style={role === 'supplier' ? S.roleActive : S.roleBtn} onClick={() => { setRole('supplier'); setError(''); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Supplier
              </button>
            </div>

            {role && (
              <form onSubmit={handleLogin}>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Email Address</label>
                  <input style={S.input} type="email" placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div style={S.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={S.label}>Password</label>
                    <span style={S.forgotLink} onClick={() => { setShowForgot(true); setError(''); }}>Forgot password?</span>
                  </div>
                  <div style={S.passWrap}>
                    <input style={{ ...S.input, paddingRight: 44 }} type={showPass ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" style={S.eyeBtn} onClick={() => setShowPass(!showPass)}>
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                {error && <p style={S.errorMsg}>{error}</p>}
                <button style={S.primaryBtn} type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : `Sign in as ${role === 'buyer' ? 'Buyer' : 'Supplier'}`}
                </button>
              </form>
            )}

            <p style={S.registerText}>
              New to Jain Agency?{' '}
              <Link to={`/register?role=${role || 'buyer'}`} style={S.linkText}>Create account</Link>
            </p>
          </div>
        )}

        {/* Footer */}
        <p style={S.footerText}>© 2026 Jain Agency · All rights reserved</p>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.navy, padding: 20, position: 'relative', overflow: 'hidden',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  bgPattern: {
    position: 'absolute', inset: 0, zIndex: 0,
    backgroundImage: `radial-gradient(circle at 20% 20%, rgba(119,90,25,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(26,43,72,0.8) 0%, transparent 50%)`,
    backgroundSize: '100% 100%',
  },
  card: {
    position: 'relative', zIndex: 1,
    backgroundColor: D.surface, borderRadius: 20,
    padding: '32px 28px', width: '100%', maxWidth: 400,
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  logoArea: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  logoMark: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  brandName: { margin: 0, fontSize: 20, fontWeight: 800, color: D.navy, letterSpacing: '-0.02em' },
  brandTagline: { margin: '2px 0 0', fontSize: 12, color: D.textSecondary, fontWeight: 500 },
  menuBtn: {
    marginLeft: 'auto', width: 36, height: 36, borderRadius: 10,
    border: `1px solid ${D.border}`, backgroundColor: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  divider: { height: 1, backgroundColor: D.border, margin: '0 0 24px', opacity: 0.5 },
  formTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: D.navy, letterSpacing: '-0.02em' },
  formSubtitle: { margin: '0 0 20px', fontSize: 13, color: D.textSecondary },
  adminBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
    backgroundColor: '#fef7e0', borderRadius: 20, padding: '4px 12px',
    fontSize: 12, fontWeight: 600, color: D.gold,
  },
  roleRow: { display: 'flex', gap: 10, marginBottom: 20 },
  roleBtn: {
    flex: 1, padding: '12px 10px', border: `1.5px solid ${D.border}`, borderRadius: 10,
    backgroundColor: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    color: D.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'all 0.15s',
  },
  roleActive: {
    flex: 1, padding: '12px 10px', border: `1.5px solid ${D.navy}`, borderRadius: 10,
    backgroundColor: D.navy, cursor: 'pointer', fontSize: 14, fontWeight: 600,
    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  fieldGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: D.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    display: 'block', width: '100%', padding: '12px 14px',
    border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14,
    color: D.textPrimary, outline: 'none', boxSizing: 'border-box',
    backgroundColor: D.bg, transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  passWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4,
  },
  forgotLink: { fontSize: 12, color: D.gold, cursor: 'pointer', fontWeight: 600 },
  primaryBtn: {
    display: 'block', width: '100%', padding: '14px',
    backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8,
    letterSpacing: '-0.01em', fontFamily: 'inherit',
  },
  ghostBtn: {
    display: 'block', width: '100%', padding: '12px',
    backgroundColor: 'transparent', color: D.textSecondary,
    border: `1.5px solid ${D.border}`, borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10,
    fontFamily: 'inherit',
  },
  errorMsg: { fontSize: 13, color: D.error, margin: '0 0 12px', fontWeight: 500 },
  successMsg: { fontSize: 13, color: D.success, margin: '0 0 12px', fontWeight: 600 },
  registerText: { textAlign: 'center', fontSize: 13, color: D.textSecondary, marginTop: 20, marginBottom: 0 },
  linkText: { color: D.gold, textDecoration: 'none', fontWeight: 700 },
  spinner: {
    width: 36, height: 36, border: `3px solid rgba(255,255,255,0.2)`,
    borderTop: `3px solid white`, borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
  footerText: { textAlign: 'center', fontSize: 11, color: D.border, marginTop: 24, marginBottom: 0 },
};

export default Login;