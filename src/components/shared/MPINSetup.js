import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const NAVY = '#031632';
const GOLD = '#775a19';
const GOLD_LIGHT = '#c9a84c';
const WHITE = '#ffffff';
const SURFACE = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.15)';
const ERROR_COLOR = '#ff6b6b';

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
        width: 52, height: 64, textAlign: 'center', fontSize: 24, fontWeight: 700,
        backgroundColor: SURFACE, border: `2px solid ${value ? GOLD_LIGHT : BORDER}`,
        borderRadius: 12, color: WHITE, outline: 'none', caretColor: 'transparent',
        transition: 'border-color 0.2s', boxSizing: 'border-box',
      }}
    />
  );
}

export default function MPINSetup({ uid, onComplete }) {
  const [step, setStep] = useState('enter'); // 'enter' | 'confirm'
  const [enterDigits, setEnterDigits] = useState(['', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const e0 = useRef(null), e1 = useRef(null), e2 = useRef(null), e3 = useRef(null);
  const c0 = useRef(null), c1 = useRef(null), c2 = useRef(null), c3 = useRef(null);
  const enterRefs = [e0, e1, e2, e3];
  const confirmRefs = [c0, c1, c2, c3];

  useEffect(() => { e0.current?.focus(); }, []);
  useEffect(() => {
    if (step === 'confirm') c0.current?.focus();
  }, [step]);

  const handleEnterChange = (i, val) => {
    const next = [...enterDigits]; next[i] = val; setEnterDigits(next); setError('');
    if (val && i < 3) enterRefs[i + 1].current?.focus();
  };
  const handleEnterKey = (i, e) => {
    if (e.key === 'Backspace' && !enterDigits[i] && i > 0) enterRefs[i - 1].current?.focus();
  };

  const handleConfirmChange = (i, val) => {
    const next = [...confirmDigits]; next[i] = val; setConfirmDigits(next); setError('');
    if (val && i < 3) confirmRefs[i + 1].current?.focus();
  };
  const handleConfirmKey = (i, e) => {
    if (e.key === 'Backspace' && !confirmDigits[i] && i > 0) confirmRefs[i - 1].current?.focus();
  };

  const handleContinue = () => {
    if (enterDigits.join('').length < 4) { setError('Enter all 4 digits'); return; }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    const pin = enterDigits.join('');
    const confirmPin = confirmDigits.join('');
    if (confirmPin.length < 4) { setError('Enter all 4 digits'); return; }
    if (pin !== confirmPin) {
      setError('PINs do not match. Try again.');
      setConfirmDigits(['', '', '', '']);
      c0.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const hash = await hashMPIN(pin);
      await setDoc(doc(db, 'users', uid, 'private', 'security'), { mpinHash: hash });
      sessionStorage.setItem(`mpin_verified_${uid}`, '1');
      onComplete();
    } catch {
      setError('Failed to save PIN. Please try again.');
      setSaving(false);
    }
  };

  const goBack = () => {
    setStep('enter');
    setConfirmDigits(['', '', '', '']);
    setError('');
  };

  const activeDigits = step === 'enter' ? enterDigits : confirmDigits;
  const allFilled = activeDigits.every(d => d !== '');

  const renderPins = (digits, refs, onChange, onKey) => (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
      {digits.map((d, i) => (
        <PinBox
          key={i}
          value={d}
          inputRef={refs[i]}
          onChange={v => onChange(i, v)}
          onKeyDown={e => onKey(i, e)}
        />
      ))}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: NAVY, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
        <h1 style={{ color: GOLD_LIGHT, fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
          {step === 'enter' ? 'Set Your MPIN' : 'Confirm Your MPIN'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '0 0 32px', lineHeight: 1.5 }}>
          {step === 'enter'
            ? 'Create a 4-digit PIN to secure your account when away.'
            : 'Re-enter your PIN to confirm.'}
        </p>

        {step === 'enter'
          ? renderPins(enterDigits, enterRefs, handleEnterChange, handleEnterKey)
          : renderPins(confirmDigits, confirmRefs, handleConfirmChange, handleConfirmKey)
        }

        {error && (
          <p style={{ color: ERROR_COLOR, fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
            {error}
          </p>
        )}

        <button
          onClick={step === 'enter' ? handleContinue : handleConfirm}
          disabled={saving || !allFilled}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            backgroundColor: GOLD, color: WHITE, fontSize: 15, fontWeight: 700,
            cursor: saving || !allFilled ? 'not-allowed' : 'pointer',
            opacity: saving || !allFilled ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {saving ? 'Saving…' : step === 'enter' ? 'Continue' : 'Set PIN'}
        </button>

        {step === 'confirm' && (
          <button
            onClick={goBack}
            style={{
              marginTop: 12, background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', width: '100%',
            }}
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
