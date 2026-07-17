import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleBackButton = App.addListener('backButton', () => {
      const isHome = location.pathname === '/';

      if (isHome) {
        App.minimizeApp();
      } else {
        const isMainTab = 
          location.pathname === '/reels' || 
          location.pathname === '/sports' || 
          location.pathname === '/reading-list';

        if (isMainTab) {
          navigate('/');
        } else {
          // Go back in the SPA history
          navigate(-1);
        }
      }
    });

    return () => {
      handleBackButton.then(listener => listener.remove());
    };
  }, [location.pathname, navigate]);
}
