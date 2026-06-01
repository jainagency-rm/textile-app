import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

function ProtectedRoute({ children, requiredRole }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'deny'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('deny');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().role === requiredRole) {
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

  if (status === 'loading') {
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
