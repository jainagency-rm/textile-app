import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Pending from './pages/Pending';

// Updated import paths to reflect the new folder structure
import AdminDashboard from './pages/admin/AdminDashboard';
import SupplierDashboard from './pages/supplier/SupplierDashboard';
import BuyerDashboard from './pages/buyer/BuyerDashboard';

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
        
        {/* Dashboards mapped to updated file names/paths */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/supplier" element={<SupplierDashboard />} />
        <Route path="/buyer" element={<BuyerDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;