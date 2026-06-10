import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { requestFCMPermission, onForegroundMessage } from '../../utils/fcm';

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
  const [status, setStatus] = useState('loading');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('deny');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().role === requiredRole) {
          setUserId(user.uid);
          setStatus('ok');
        } else {
          setStatus('deny');
        }
      } catch {
        setStatus('deny');
      }
    });
    return () => unsubscribe();
  }, [requiredRole]);

  useEffect(() => {
    if (!userId) return;

    requestFCMPermission(userId);

    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title) showFCMToast(title, body || '');
    });

    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [userId]);

  if (status === 'loading') {
    // App.js already resolved auth before rendering routes.
    // If auth.currentUser exists, suppress the loading screen — role check
    // completes on the next tick. Returning null prevents the loading flash
    // on re-mounts and iOS Safari resize-triggered re-renders.
    if (auth.currentUser) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#44474d', fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  if (status === 'deny') {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
