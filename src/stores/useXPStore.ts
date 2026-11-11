import { useCallback, useEffect, useState } from 'react';

type XPState = {
  points: number;
  streak: number;
};

const STORAGE_KEY = 'realssa-xp';
const DEFAULT_STATE: XPState = { points: 0, streak: 0 };

const readState = (): XPState => {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<XPState>;
    return {
      points: Number.isFinite(Number(parsed.points)) ? Math.max(0, Number(parsed.points)) : 0,
      streak: Number.isFinite(Number(parsed.streak)) ? Math.max(0, Number(parsed.streak)) : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
};

export const useXPStore = () => {
  const [state, setState] = useState<XPState>(readState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Local storage can be unavailable in private/restricted browser contexts.
    }
  }, [state]);

  const addPoints = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setState(current => ({ ...current, points: current.points + Math.floor(amount) }));
  }, []);

  const setPoints = useCallback((points: number) => {
    if (!Number.isFinite(points)) return;
    setState(current => ({ ...current, points: Math.max(0, Math.floor(points)) }));
  }, []);

  const setStreak = useCallback((streak: number) => {
    if (!Number.isFinite(streak)) return;
    setState(current => ({ ...current, streak: Math.max(0, Math.floor(streak)) }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  return {
    points: state.points,
    streak: state.streak,
    addPoints,
    setPoints,
    setStreak,
    reset,
  };
};

export default useXPStore;
