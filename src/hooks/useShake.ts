import { useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '@/lib/api-base';

export function useShakeToDiscover() {
  const navigate = useNavigate();
  const lastShake = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let motionListener: any = null;

    const setupMotion = async () => {
      try {
        // Request permission if needed (some OS versions require it)
        try {
          if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            await (DeviceMotionEvent as any).requestPermission();
          }
        } catch (e) {
          console.warn('Motion permission request failed', e);
        }

        motionListener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.acceleration || { x: 0, y: 0, z: 0 };
          
          // Calculate total acceleration (magnitude)
          const acceleration = Math.sqrt(x * x + y * y + z * z);

          // Threshold for a "shake" (approx 15-20 m/s^2 depending on device)
          if (acceleration > 18) {
            const now = Date.now();
            // Prevent multiple triggers in a 2-second window
            if (now - lastShake.current > 2000) {
              lastShake.current = now;
              handleShake();
            }
          }
        });
      } catch (err) {
        console.error('Motion listener failed to attach', err);
      }
    };

    const handleShake = async () => {
      try {
        // Vibrate immediately for tactile feedback
        await Haptics.impact({ style: ImpactStyle.Heavy });

        // Fetch trending articles to pick a random one
        const res = await fetch(apiUrl('/api/articles/trending'));
        if (res.ok) {
          const articles = await res.json();
          if (articles.length > 0) {
            const randomArticle = articles[Math.floor(Math.random() * articles.length)];
            // Navigate to the article
            navigate(`/article/${randomArticle.id}`);
          }
        }
      } catch (err) {
        console.error('Shake to discover failed', err);
      }
    };

    setupMotion();

    return () => {
      if (motionListener) {
        motionListener.remove();
      }
    };
  }, [navigate]);
}
