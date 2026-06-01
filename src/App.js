import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Pending from './pages/Pending';
import ProtectedRoute from './components/shared/ProtectedRoute';

const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const SupplierDashboard = React.lazy(() => import('./pages/supplier/SupplierDashboard'));
const BuyerDashboard = React.lazy(() => import('./pages/buyer/BuyerDashboard'));

const LoadingScreen = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'sans-serif' }}>
    <p style={{ color: '#44474d', fontSize: 14 }}>Loading...</p>
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

    let touchStartX = 0;
    const handleTouchStart = (e) => { touchStartX = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (diff > 80) navigate(-1);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate]);

  return null;
}

function App() {
  return (
    <Router>
      <GlobalHandlers />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<Pending />} />

        <Route path="/admin" element={
          <ProtectedRoute requiredRole="admin">
            <Suspense fallback={<LoadingScreen />}>
              <AdminDashboard />
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/supplier" element={
          <ProtectedRoute requiredRole="supplier">
            <Suspense fallback={<LoadingScreen />}>
              <SupplierDashboard />
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/buyer" element={
          <ProtectedRoute requiredRole="buyer">
            <Suspense fallback={<LoadingScreen />}>
              <BuyerDashboard />
            </Suspense>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
