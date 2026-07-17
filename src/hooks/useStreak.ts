import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';

const STREAK_KEY = 'user_reading_streak';
const LAST_READ_DATE_KEY = 'last_read_date';

export function useStreak() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const checkStreak = async () => {
      try {
        const streakRes = await Preferences.get({ key: STREAK_KEY });
        const lastDateRes = await Preferences.get({ key: LAST_READ_DATE_KEY });
        
        const currentStreak = parseInt(streakRes.value || '0', 10);
        const lastReadDate = lastDateRes.value;
        const today = new Date().toDateString();

        if (lastReadDate) {
          const lastDate = new Date(lastReadDate);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          if (lastReadDate === today) {
            // Already read today, streak remains the same
            setStreak(currentStreak);
          } else if (lastDate.toDateString() === yesterday.toDateString()) {
            // Read yesterday, increment streak
            const newStreak = currentStreak + 1;
            setStreak(newStreak);
            await Preferences.set({ key: STREAK_KEY, value: newStreak.toString() });
            await Preferences.set({ key: LAST_READ_DATE_KEY, value: today });
          } else {
            // Missed a day, reset streak to 1 (since they are reading today)
            setStreak(1);
            await Preferences.set({ key: STREAK_KEY, value: '1' });
            await Preferences.set({ key: LAST_READ_DATE_KEY, value: today });
          }
        } else {
          // First time reading ever
          setStreak(1);
          await Preferences.set({ key: STREAK_KEY, value: '1' });
          await Preferences.set({ key: LAST_READ_DATE_KEY, value: today });
        }
      } catch (err) {
        console.error('Failed to load streak', err);
      }
    };

    checkStreak();
  }, []);

  return streak;
}
