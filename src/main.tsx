import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Ensure any previously installed offline Service Worker & caches are removed so the app runs 100% online
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

if (typeof window !== 'undefined' && 'caches' in window) {
  caches
    .keys()
    .then((keys) => {
      keys.forEach((key) => {
        caches.delete(key).catch(() => {});
      });
    })
    .catch(() => {});
}
