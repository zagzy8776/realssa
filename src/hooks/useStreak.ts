import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STREAK_KEY = 'user_reading_streak';
const LONGEST_STREAK_KEY = 'user_longest_streak';
const LAST_READ_DATE_KEY = 'last_read_date';

export function useStreak() {
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  // Helper to get or generate device ID
  const getDeviceId = useCallback(() => {
    let id = localStorage.getItem('realssa_device_uuid');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('realssa_device_uuid', id);
    }
    return id;
  }, []);

  const syncStreakWithServer = useCallback(async () => {
    const deviceId = getDeviceId();
    try {
      const response = await axios.post('/api/users/streak', { deviceId });
      const { currentStreak, longestStreak: longest, lastReadAt } = response.data;
      
      setStreak(currentStreak);
      setLongestStreak(longest);
      
      localStorage.setItem(STREAK_KEY, String(currentStreak));
      localStorage.setItem(LONGEST_STREAK_KEY, String(longest));
      localStorage.setItem(LAST_READ_DATE_KEY, lastReadAt);
    } catch (err) {
      console.error('Failed to sync streak with server:', err);
      // Fallback to local storage if server is unreachable
      const cachedStreak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
      const cachedLongest = parseInt(localStorage.getItem(LONGEST_STREAK_KEY) || '0', 10);
      setStreak(cachedStreak);
      setLongestStreak(cachedLongest);
    } finally {
      setLoading(false);
    }
  }, [getDeviceId]);

  useEffect(() => {
    syncStreakWithServer();
  }, [syncStreakWithServer]);

  // Call this function when user reads/opens an article to increment their streak
  const recordRead = useCallback(async () => {
    const deviceId = getDeviceId();
    try {
      const response = await axios.post('/api/users/streak', { deviceId });
      const { currentStreak, longestStreak: longest, lastReadAt } = response.data;
      
      setStreak(currentStreak);
      setLongestStreak(longest);
      
      localStorage.setItem(STREAK_KEY, String(currentStreak));
      localStorage.setItem(LONGEST_STREAK_KEY, String(longest));
      localStorage.setItem(LAST_READ_DATE_KEY, lastReadAt);
    } catch (err) {
      console.error('Failed to record read/update streak:', err);
    }
  }, [getDeviceId]);

  return {
    streak,
    longestStreak,
    loading,
    recordRead,
    syncStreakWithServer
  };
}
