import { useEffect } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Event-Driven Haptics Hook
 *
 * Provides automatic haptic feedback for non-user-triggered events:
 * - Goals scored in live matches
 * - Crypto price support/resistance breaks
 * - Market panic alerts
 * - Breaking news pushes
 *
 * Usage:
 *   const { triggerGoalHaptic, triggerCryptoHaptic, triggerPanicHaptic } = useEventHaptics();
 */

const HAPTIC_CONFIG = {
  goal: { style: ImpactStyle.Heavy as any, repeats: 2, delay: 300 },
  cryptoBreak: { style: ImpactStyle.Medium as any, repeats: 1 },
  panic: { style: ImpactStyle.Heavy as any, repeats: 3, delay: 200 },
  breaking: { style: ImpactStyle.Light as any, repeats: 1 },
} as const;

type HapticType = keyof typeof HAPTIC_CONFIG;

function vibrate(pattern: { style: any; repeats: number; delay?: number }) {
  if (!Capacitor.isNativePlatform()) return;
  let count = 0;
  const interval = setInterval(() => {
    Haptics.impact({ style: pattern.style });
    count++;
    if (count >= pattern.repeats) clearInterval(interval);
  }, pattern.delay || 500);
}

export function useEventHaptics() {
  const triggerGoalHaptic = () => {
    vibrate(HAPTIC_CONFIG.goal);
  };

  const triggerCryptoHaptic = () => {
    vibrate(HAPTIC_CONFIG.cryptoBreak);
  };

  const triggerPanicHaptic = () => {
    vibrate(HAPTIC_CONFIG.panic);
  };

  const triggerBreakingHaptic = () => {
    vibrate(HAPTIC_CONFIG.breaking);
  };

  // Listen for custom haptic events dispatched from anywhere in the app
  useEffect(() => {
    const handleGoal = () => triggerGoalHaptic();
    const handleCrypto = () => triggerCryptoHaptic();
    const handlePanic = () => triggerPanicHaptic();
    const handleBreaking = () => triggerBreakingHaptic();

    window.addEventListener('realssa:haptic:goal', handleGoal);
    window.addEventListener('realssa:haptic:crypto', handleCrypto);
    window.addEventListener('realssa:haptic:panic', handlePanic);
    window.addEventListener('realssa:haptic:breaking', handleBreaking);

    return () => {
      window.removeEventListener('realssa:haptic:goal', handleGoal);
      window.removeEventListener('realssa:haptic:crypto', handleCrypto);
      window.removeEventListener('realssa:haptic:panic', handlePanic);
      window.removeEventListener('realssa:haptic:breaking', handleBreaking);
    };
  }, []);

  return { triggerGoalHaptic, triggerCryptoHaptic, triggerPanicHaptic, triggerBreakingHaptic };
}

export { Haptics, ImpactStyle, Capacitor };
