import React, { useState, useRef, useEffect } from 'react';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';

const NAVY = '#031632';
const GOLD = '#c9a84c';
const WHITE = '#ffffff';
const ERROR_COLOR = '#ff6b6b';
const MAX_ATTEMPTS = 3;

async function hashMPIN(mpin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mpin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function PinBox({ value, inputRef, onChange, onKeyDown }) {
  return (
    <input
      ref={inputRef}
      type="password"
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 1))}
      onKeyDown={onKeyDown}
      style={{
        width: 58, height: 58, textAlign: 'center', fontSize: 24, fontWeight: 700,
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: `2px solid ${value ? WHITE : 'rgba(255,255,255,0.35)'}`,
        borderRadius: 14, color: WHITE, outline: 'none', caretColor: 'transparent',
        transition: 'border-color 0.2s', boxSizing: 'border-box',
      }}
    />
  );
}

export default function MPINLock({ uid, firmName, onUnlock, onResetMPIN }) {
  const navigate = useNavigate();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [resetting, setResetting] = useState(false);

  const r0 = useRef(null), r1 = useRef(null), r2 = useRef(null), r3 = useRef(null);
  const refs = [r0, r1, r2, r3];

  useEffect(() => { r0.current?.focus(); }, []);

  const handleChange = (i, val) => {
    const next = [...digits]; next[i] = val; setDigits(next); setError('');
    if (val && i < 3) refs[i + 1].current?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const completeUnlock = () => {
    sessionStorage.setItem(`mpin_verified_${uid}`, '1');

    const preLockUrl = localStorage.getItem(`pre_lock_url_${uid}`);
    if (preLockUrl) {
      localStorage.removeItem(`pre_lock_url_${uid}`);
      onUnlock();
      try {
        const url = new URL(preLockUrl);
        navigate(url.pathname + url.search + url.hash, { replace: true });
      } catch {}
      return;
    }

    onUnlock();
  };

  const handleSubmit = async () => {
    const pin = digits.join('');
    if (pin.length < 4) { setError('Enter all 4 digits'); return; }

    setVerifying(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'private', 'security'));
      const storedHash = snap.data()?.mpinHash;
      const hash = await hashMPIN(pin);

      if (hash === storedHash) {
        completeUnlock();
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setDigits(['', '', '', '']);
      r0.current?.focus();

      if (newAttempts >= MAX_ATTEMPTS) {
        sessionStorage.removeItem(`mpin_verified_${uid}`);
        await signOut(auth);
        navigate('/');
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
        setVerifying(false);
      }
    } catch {
      setError('Verification failed. Please try again.');
      setVerifying(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotMsg('');
    const email = auth.currentUser?.email;
    if (!email) { setForgotMsg('No email on file for this account.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setForgotMsg('Reset link sent to your email.');
    } catch {
      setForgotMsg('Could not send reset link. Try again later.');
    }
  };

  const handleResetMPIN = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await deleteDoc(doc(db, 'users', uid, 'private', 'security'));
      localStorage.removeItem(`mpin_verified_${uid}`);
      onResetMPIN();
    } catch {
      setError('Could not reset PIN. Try again.');
      setResetting(false);
    }
  };

  const allFilled = digits.every(d => d !== '');

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: NAVY, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '32px 24px',
      overflowY: 'auto',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>

        <img src="/logo192.png" alt="Jain Agency" style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 8 }} />
        <p style={{
          color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 28px',
        }}>
          Jain Agency
        </p>

        <h1 style={{ color: WHITE, fontSize: 21, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          Login using mPIN
        </h1>
        <p style={{ color: GOLD, fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>
          Welcome {firmName || 'back'}!
        </p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 24px' }}>
          Enter mPIN below
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
          {digits.map((d, i) => (
            <PinBox
              key={i}
              value={d}
              inputRef={refs[i]}
              onChange={v => handleChange(i, v)}
              onKeyDown={e => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && (
          <p style={{ color: ERROR_COLOR, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: forgotMsg ? 8 : 28, fontSize: 13, fontWeight: 600 }}>
          <span onClick={handleForgotPassword} style={{ color: GOLD, cursor: 'pointer' }}>
            Forgot Password?
          </span>
          <span
            onClick={handleResetMPIN}
            style={{ color: GOLD, cursor: resetting ? 'default' : 'pointer', opacity: resetting ? 0.6 : 1 }}
          >
            {resetting ? 'Resetting…' : 'Reset mPIN?'}
          </span>
        </div>

        {forgotMsg && (
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '0 0 20px' }}>{forgotMsg}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={verifying || !allFilled}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            backgroundColor: GOLD, color: NAVY, fontSize: 15, fontWeight: 700,
            cursor: verifying || !allFilled ? 'not-allowed' : 'pointer',
            opacity: verifying || !allFilled ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {verifying ? 'Verifying…' : 'Login'}
        </button>
      </div>
    </div>
  );
}
