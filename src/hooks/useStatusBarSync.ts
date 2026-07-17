import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export function useStatusBarSync() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncStatusBar = async () => {
      try {
        const isDark = document.documentElement.classList.contains('dark');
        
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light,
        });
        
        await StatusBar.setBackgroundColor({
          color: isDark ? '#000000' : '#ffffff',
        });
      } catch (err) {
        console.warn('Status bar sync failed', err);
      }
    };

    // Sync on mount
    syncStatusBar();

    // Observe changes to the 'dark' class on the html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          syncStatusBar();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);
}
