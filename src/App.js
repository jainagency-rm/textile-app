import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Pending from './pages/Pending';
import AdminDashboard from './pages/admin/Dashboard';
import SupplierDashboard from './pages/supplier/Dashboard';
import BuyerDashboard from './pages/buyer/Dashboard';

// Global ESC + Swipe handler
function GlobalHandlers() {
  const navigate = useNavigate();

  useEffect(() => {
    // ESC — browser back (modals apne aap band honge agar bahar click ya ESC handle kar rahe hain)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Custom event fire karo — saare components sun sakte hain
        window.dispatchEvent(new CustomEvent('closeModal'));
      }
    };

    // Swipe left to right — ek step back
    let touchStartX = 0;
    const handleTouchStart = (e) => { touchStartX = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (diff > 80) navigate(-1); // 80px swipe = back
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
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/supplier" element={<SupplierDashboard />} />
        <Route path="/buyer" element={<BuyerDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;