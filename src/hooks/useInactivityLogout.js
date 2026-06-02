import { useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const TIMEOUT_MS = 60 * 60* 1000; // 60 minutes
const WARNING_MS = 60 * 55 * 1000; // warn at 55 minutes

export function useInactivityLogout() {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const warningShownRef = useRef(false);

  const resetTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
    warningShownRef.current = false;

    const existing = document.getElementById('inactivity-warning');
    if (existing) existing.remove();

    warningRef.current = setTimeout(() => {
      if (warningShownRef.current) return;
      warningShownRef.current = true;

      const toast = document.createElement('div');
      toast.id = 'inactivity-warning';
      toast.innerHTML = `
        <div style="
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          background-color: #031632; color: white; padding: 14px 20px;
          border-radius: 12px; font-size: 13px; font-weight: 600;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 9999;
          display: flex; align-items: center; gap: 12px; white-space: nowrap;
        ">
          ⚠️ Session expires in 5 minutes
          <button onclick="document.getElementById('inactivity-warning').remove()" style="
            background: rgba(255,255,255,0.2); border: none; color: white;
            padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;
          ">Stay Logged In</button>
        </div>
      `;
      document.body.appendChild(toast);
    }, WARNING_MS);

    timeoutRef.current = setTimeout(async () => {
      const existing = document.getElementById('inactivity-warning');
      if (existing) existing.remove();
      await signOut(auth);
      navigate('/');
    }, TIMEOUT_MS);
  }, [navigate]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(timeoutRef.current);
      clearTimeout(warningRef.current);
      const existing = document.getElementById('inactivity-warning');
      if (existing) existing.remove();
    };
  }, [resetTimer]);
}
