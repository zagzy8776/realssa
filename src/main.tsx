import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { CapacitorUpdater } from '@capgo/capacitor-updater';

CapacitorUpdater.notifyAppReady();
import "./index.css";

// Sync dark mode with system preference
const applySystemTheme = () => {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', isDark);
};
applySystemTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);
// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}

// Global fetch interceptor to completely eradicate Punch news from the frontend everywhere
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
  
  if (url.includes('/api/articles') || url.includes('/api/news') || url.includes('/api/stories')) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if (Array.isArray(data)) {
        const filtered = data.filter((item: any) => {
          const sourceName = (item.source_name || item.source || '').toLowerCase();
          const itemUrl = (item.url || '').toLowerCase();
          return !sourceName.includes('punch') && !itemUrl.includes('punchng.com');
        });
        return new Response(JSON.stringify(filtered), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return response;
};

createRoot(document.getElementById("root")!).render(<App />);

// Clean up the initial HTML startup loader once React is hydrated
try {
  const loader = document.getElementById("startup-loader");
  if (loader) {
    loader.style.transition = "opacity 0.5s ease";
    loader.style.opacity = "0";
    setTimeout(() => loader.remove(), 500);
  }
} catch (e) {
  console.warn("Failed to remove startup loader:", e);
}

