import React, { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { requestFCMPermission, onForegroundMessage } from '../../utils/fcm';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';
import MPINSetup from './MPINSetup';
import MPINLock from './MPINLock';


function showFCMToast(title, body) {
  const existing = document.getElementById('fcm-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'fcm-toast';
  toast.innerHTML = `
    <div style="
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background-color: #031632; color: white; padding: 14px 20px;
      border-radius: 12px; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 9999;
      max-width: 320px; min-width: 200px; font-family: 'Inter', sans-serif;
    ">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div style="font-weight: 700; margin-bottom: 4px;">${title}</div>
          <div style="font-weight: 400; opacity: 0.85; font-size: 12px;">${body}</div>
        </div>
        <button onclick="document.getElementById('fcm-toast').remove()" style="
          background: rgba(255,255,255,0.2); border: none; color: white;
          padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; flex-shrink: 0;
        ">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    const el = document.getElementById('fcm-toast');
    if (el) el.remove();
  }, 5000);
}

function ProtectedRoute({ children, requiredRole }) {
  // screen: 'loading' | 'deny' | 'setup' | 'locked' | 'ok'
  const [screen, setScreen] = useState('loading');
  const [uid, setUid] = useState(null);
  const [userData, setUserData] = useState(null); // { firmName, role }

  const handleLock = useCallback(() => setScreen('locked'), []);
  useInactivityLogout(screen === 'ok' ? handleLock : null);

  useEffect(() => {
    if (screen === 'locked' && uid) {
      localStorage.setItem(`pre_lock_url_${uid}`, window.location.href);
    }
  }, [screen, uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setScreen('deny'); return; }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists() || snap.data().role !== requiredRole) {
          setScreen('deny');
          return;
        }
        const data = snap.data();
        setUid(user.uid);
        setUserData({ firmName: data.firmName || data.name || '', role: data.role });

        const secSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'security'));
        if (!secSnap.exists() || !secSnap.data()?.mpinHash) {
          setScreen('setup');
          return;
        }

        const unlocked = sessionStorage.getItem(`mpin_verified_${user.uid}`);
        setScreen(unlocked ? 'ok' : 'locked');
      } catch {
        setScreen('deny');
      }
    });
    return () => unsubscribe();
  }, [requiredRole]);

  useEffect(() => {
    if (!uid) return;
    requestFCMPermission(uid);
    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title) showFCMToast(title, body || '');
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [uid]);

  if (screen === 'loading') {
    if (auth.currentUser) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#031632', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo192.png" alt="Jain Agency" style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 20 }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (screen === 'deny') return <Navigate to="/" replace />;

  if (screen === 'setup' && uid) {
    return <MPINSetup uid={uid} onComplete={() => setScreen('ok')} />;
  }

  if (screen === 'locked' && uid) {
    return (
      <MPINLock
        uid={uid}
        firmName={userData?.firmName}
        onUnlock={() => setScreen('ok')}
        onResetMPIN={() => setScreen('setup')}
      />
    );
  }

  return children;
}

export default ProtectedRoute;
