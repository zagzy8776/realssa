import { useState, useEffect } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const useGeolocation = () => {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const permission = await Geolocation.checkPermissions();
          if (permission.location !== 'granted') {
            const request = await Geolocation.requestPermissions();
            if (request.location !== 'granted') {
              setError('Location permission denied.');
              return;
            }
          }
        }
        const coords = await Geolocation.getCurrentPosition();
        setPosition(coords);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch location.');
      }
    };

    fetchLocation();
  }, []);

  return { position, error };
};
