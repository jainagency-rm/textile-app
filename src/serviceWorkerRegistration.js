function showUpdateToast(registration) {
  const existing = document.getElementById('pwa-update-toast');
  if (existing) return;

  const toast = document.createElement('div');
  toast.id = 'pwa-update-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #031632;
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-family: Inter, sans-serif;
    font-weight: 600;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    white-space: nowrap;
  `;

  const msg = document.createElement('span');
  msg.textContent = '🔄 New update available!';

  const btn = document.createElement('button');
  btn.textContent = 'Refresh';
  btn.style.cssText = `
    background: #775a19;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: Inter, sans-serif;
  `;

  btn.addEventListener('click', () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  });

  toast.appendChild(msg);
  toast.appendChild(btn);
  document.body.appendChild(toast);
}

export function register() {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
      navigator.serviceWorker.register(swUrl).then(registration => {
        // SW already waiting from a previous page load — show toast immediately
        if (registration.waiting) {
          showUpdateToast(registration);
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.onstatechange = () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showUpdateToast(registration);
            }
          };
        };
      }).catch(err => {
        console.error('Service worker registration failed:', err);
      });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => registration.unregister())
      .catch(err => console.error(err));
  }
}
