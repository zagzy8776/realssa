import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady();
}
import "./index.css";
import "./ui-v2.css";
import "./mobile-nav-fixes.css";
import { applyUiVersion } from "./lib/uiFlag";

applyUiVersion();

// Detect stale chunk loading errors and force reload once
// This happens when Vercel deploys new code with new hashed filenames
// but the user's browser has cached the old index.html
window.addEventListener('error', (event) => {
  const isChunkError = event.message?.includes('Failed to fetch dynamically imported module') ||
                       event.message?.includes('Importing a module script failed');
  
  if (isChunkError) {
    const hasReloaded = sessionStorage.getItem('chunk-reload-attempted');
    if (!hasReloaded) {
      console.warn('[ChunkError] Stale build detected, forcing reload...');
      sessionStorage.setItem('chunk-reload-attempted', 'true');
      window.location.reload();
    } else {
      console.error('[ChunkError] Reload already attempted, showing error');
    }
  }
});

// Sync dark mode with system preference
const applySystemTheme = () => {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', isDark);
};
applySystemTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

// The production service worker must never run on Vercel previews, localhost,
// or other alternate hosts. Those environments are commonly used for testing
// and can also expose Vercel's own SSO resources to the page.
const PRODUCTION_HOST = 'www.realssanews.com.ng';
if ('serviceWorker' in navigator) {
  if (window.location.hostname === PRODUCTION_HOST) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  } else {
    // Remove any service worker left behind from an older preview build.
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => undefined);
  }
}

// Punch blocking is now handled server-side in api/home-feed.js BLOCKED_HOSTS
// and api/index.js honeypot routes. No client-side filtering needed.
// This keeps the interceptor free for future client-side security hooks.
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
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
