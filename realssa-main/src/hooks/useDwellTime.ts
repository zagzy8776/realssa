import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { apiUrl } from '@/lib/api-base';

/**
 * Captures dwell time for a given category and sends it to the backend on exit.
 * Uses visibilitychange (web) + Capacitor appStateChange (WebView/native) for reliability.
 * Same pattern as keepalive — avoids beforeunload which doesn't fire on mobile WebView.
 */
export function useDwellTime(category: string | undefined, articleId?: string) {
  const startRef = useRef<number>(Date.now());
  const sentRef = useRef<boolean>(false);

  const sendDwell = (seconds: number) => {
    if (sentRef.current || !category || seconds < 3) return;
    sentRef.current = true;

    const deviceId = localStorage.getItem('realssa_device_uuid') || '';
    if (!deviceId) return;

    // Use sendBeacon for reliability on page unload — falls back to fetch
    const payload = JSON.stringify({ deviceId, category, seconds, articleId });
    const url = apiUrl('/api/users/dwell');

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!category) return;
    startRef.current = Date.now();
    sentRef.current = false;

    // Web: visibilitychange fires when tab is hidden or user navigates away
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const seconds = Math.round((Date.now() - startRef.current) / 1000);
        sendDwell(seconds);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Native WebView: appStateChange fires when app goes to background
    let appStateListener: any = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          const seconds = Math.round((Date.now() - startRef.current) / 1000);
          sendDwell(seconds);
        }
      }).then(l => { appStateListener = l; });
    }

    return () => {
      // Component unmount = user navigated away
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      sendDwell(seconds);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      appStateListener?.remove();
    };
  }, [category, articleId]);
}
