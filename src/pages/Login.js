import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

function Login() {
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
            const userData = userDoc.data();
            if (userData.role === 'admin') navigate('/admin');
            else if (userData.status === 'pending') navigate('/pending');
            else if (userData.role === 'buyer') navigate('/buyer');
            else if (userData.role === 'supplier') navigate('/supplier');
          }
        } catch (err) {
          console.error("Auto-login error:", err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!role) { setError('Please select Buyer or Supplier'); return; }
    setLoading(true);
    setError('');
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      if (!userDoc.exists()) { setError('User not found'); setLoading(false); return; }
      const userData = userDoc.data();
      if (userData.role === 'admin') { navigate('/admin'); return; }
      if (userData.role !== role) { setError('Invalid role selected'); setLoading(false); return; }
      if (userData.status === 'pending') { navigate('/pending'); return; }
      if (userData.role === 'buyer') navigate('/buyer');
      else if (userData.role === 'supplier') navigate('/supplier');
    } catch (err) {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      if (!userDoc.exists()) { setError('User not found'); setLoading(false); return; }
      const userData = userDoc.data();
      if (userData.role !== 'admin') { setError('Not an admin account'); setLoading(false); return; }
      navigate('/admin');
    } catch (err) {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setError('');
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotMsg('Reset link sent! Check your email.');
    } catch (err) {
      setError('Email not found. Check and try again.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <div>
            <h1 style={styles.title}>Jain Agency</h1>
            <p style={styles.subtitle}>Textile Marketplace</p>
          </div>
          <button style={styles.menuBtn} onClick={() => { setShowAdmin(!showAdmin); setShowForgot(false); setRole(''); setError(''); setEmail(''); setPassword(''); }} title="Admin Login">
            ☰
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#666' }}>Checking session...</p>
        ) : showForgot ? (
          <form onSubmit={handleForgotPassword} style={styles.form}>
            <p style={styles.adminTitle}>Reset Password</p>
            <input style={styles.input} type="email" placeholder="Enter your registered email"
              value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            {error && <p style={styles.error}>{error}</p>}
            {forgotMsg && <p style={styles.success}>{forgotMsg}</p>}
            <button style={styles.loginButton} type="submit">Send Reset Link</button>
            <button style={styles.backBtn} type="button" onClick={() => { setShowForgot(false); setError(''); setForgotMsg(''); }}>Back</button>
          </form>
        ) : !showAdmin ? (
          <>
            <div style={styles.roleContainer}>
              <button style={role === 'buyer' ? styles.roleButtonActive : styles.roleButton} onClick={() => setRole('buyer')}>Buyer Login</button>
              <button style={role === 'supplier' ? styles.roleButtonActive : styles.roleButton} onClick={() => setRole('supplier')}>Supplier Login</button>
            </div>

            {role && (
              <form onSubmit={handleLogin} style={styles.form}>
                <input style={styles.input} type="email" placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required />
                <input style={styles.input} type="password" placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required />
                {error && <p style={styles.error}>{error}</p>}
                <button style={styles.loginButton} type="submit" disabled={loading}>Login</button>
                <p style={styles.forgotText}>
                  <span style={styles.link} onClick={() => { setShowForgot(true); setError(''); }}>Forgot Password?</span>
                </p>
                <p style={styles.registerText}>
                  Don't have an account?{' '}
                  <Link to={`/register?role=${role}`} style={styles.link}>Register here</Link>
                </p>
              </form>
            )}
          </>
        ) : (
          <form onSubmit={handleAdminLogin} style={styles.form}>
            <p style={styles.adminTitle}>Admin Login</p>
            <input style={styles.input} type="email" placeholder="Admin Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <input style={styles.input} type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.loginButton} type="submit" disabled={loading}>Admin Login</button>
            <button style={styles.backBtn} type="button" onClick={() => { setShowAdmin(false); setError(''); }}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 2px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' },
  title: { color: '#1a1a2e', margin: '0 0 5px 0', fontSize: '28px' },
  subtitle: { color: '#666', margin: '0' },
  menuBtn: { backgroundColor: 'transparent', border: '1px solid #ddd', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '18px', color: '#555' },
  roleContainer: { display: 'flex', gap: '10px', marginBottom: '25px' },
  roleButton: { flex: 1, padding: '12px', border: '2px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontSize: '14px' },
  roleButtonActive: { flex: 1, padding: '12px', border: '2px solid #1a1a2e', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#1a1a2e', color: 'white', fontSize: '14px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  loginButton: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  backBtn: { padding: '10px', backgroundColor: '#ddd', color: '#333', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  error: { color: 'red', fontSize: '13px', margin: '0' },
  success: { color: '#10b981', fontSize: '13px', margin: '0' },
  registerText: { textAlign: 'center', fontSize: '13px', color: '#666' },
  forgotText: { textAlign: 'center', fontSize: '13px', margin: '0' },
  link: { color: '#e63946', textDecoration: 'none', cursor: 'pointer' },
  adminTitle: { fontWeight: 'bold', fontSize: '16px', color: '#1a1a2e', textAlign: 'center', margin: '0' },
};

export default Login;