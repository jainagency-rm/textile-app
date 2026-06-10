import { useEffect, useRef, useCallback } from 'react';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 25 * 60 * 1000; // warn at 25 minutes

export function useInactivityLogout(onLock) {
  const onLockRef = useRef(onLock);
  useEffect(() => { onLockRef.current = onLock; });

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
          ⚠️ App will lock in 5 minutes
          <button onclick="document.getElementById('inactivity-warning').remove()" style="
            background: rgba(255,255,255,0.2); border: none; color: white;
            padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;
          ">Dismiss</button>
        </div>
      `;
      document.body.appendChild(toast);
    }, WARNING_MS);

    timeoutRef.current = setTimeout(() => {
      const w = document.getElementById('inactivity-warning');
      if (w) w.remove();
      if (onLockRef.current) onLockRef.current();
    }, TIMEOUT_MS);
  }, []); // stable — onLock accessed via ref

  useEffect(() => {
    if (!onLock) return;
    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(timeoutRef.current);
      clearTimeout(warningRef.current);
      const w = document.getElementById('inactivity-warning');
      if (w) w.remove();
    };
  }, [onLock, resetTimer]);
}
