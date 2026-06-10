import React, { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Login from './pages/Login';
import ProtectedRoute from './components/shared/ProtectedRoute';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const SupplierDashboard = lazy(() => import('./pages/supplier/SupplierDashboard'));
const BuyerDashboard = lazy(() => import('./pages/buyer/BuyerDashboard'));
const Register = lazy(() => import('./pages/Register'));
const Pending = lazy(() => import('./pages/Pending'));

const LoadingScreen = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#031632', color: 'white', fontSize: 16, fontWeight: 600 }}>
    Loading...
  </div>
);

// Global ESC + Swipe handler
function GlobalHandlers() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('closeModal'));
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // --- SAFARI SWIPE-BACK TRAP ---
    // Push an initial dummy state so there's always something in the stack
    window.history.pushState(null, null, window.location.href);

    const handlePopState = () => {
      // When iOS swipe-back is triggered, instantly push the current URL
      // back into history, completely neutralizing the back navigation.
      window.history.pushState(null, null, window.location.href);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  return null;
}

function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => setAuthReady(true));
    return () => unsubscribe();
  }, []);

  if (!authReady) return <LoadingScreen />;

  return (
    <Router>
      <GlobalHandlers />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<Pending />} />

          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/supplier" element={
            <ProtectedRoute requiredRole="supplier">
              <SupplierDashboard />
            </ProtectedRoute>
          } />

          <Route path="/buyer" element={
            <ProtectedRoute requiredRole="buyer">
              <BuyerDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
