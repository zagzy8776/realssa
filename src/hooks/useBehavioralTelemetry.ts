import { useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '@/lib/api-base';

interface TelemetryEvent {
  sensor: 'velocity' | 'intent_hover' | 'attention' | 'interaction_depth';
  sensorId?: string;
  metric: string;
  value: number | string | object;
  timestamp: number;
  url: string;
}

const BATCH_SIZE_THRESHOLD = 20;
const IDLE_TIMEOUT_MS = 30000; // 30 seconds idle pause

export function useBehavioralTelemetry() {
  const eventsQueueRef = useRef<TelemetryEvent[]>([]);
  const activeDwellSecondsRef = useRef<number>(0);
  const isTabActiveRef = useRef<boolean>(!document.hidden);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flush accumulated telemetry queue via sendBeacon
  const flushQueue = useCallback(() => {
    if (eventsQueueRef.current.length === 0) return;

    const deviceId = localStorage.getItem('realssa_device_uuid') || 'anon-device';
    const payload = JSON.stringify({
      deviceId,
      events: eventsQueueRef.current,
      activeDwellSeconds: activeDwellSecondsRef.current,
      timestamp: Date.now(),
    });

    const endpoint = apiUrl('/api/telemetry');

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }

    // Reset queue after flush
    eventsQueueRef.current = [];
  }, []);

  // Enqueue a single telemetry event (zero-re-render)
  const pushEvent = useCallback((event: Omit<TelemetryEvent, 'timestamp' | 'url'>) => {
    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: Date.now(),
      url: window.location.pathname,
    };

    eventsQueueRef.current.push(fullEvent);

    // Auto-flush when batch threshold is reached
    if (eventsQueueRef.current.length >= BATCH_SIZE_THRESHOLD) {
      flushQueue();
    }
  }, [flushQueue]);

  // 1. Attention Sensor: Active Dwell Timer & Tab Focus/Visibility Logic
  useEffect(() => {
    const resetIdleTimer = () => {
      if (!isTabActiveRef.current) return;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      idleTimerRef.current = setTimeout(() => {
        // User has been idle for >30s, pause dwell accumulation
        isTabActiveRef.current = false;
      }, IDLE_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isTabActiveRef.current = false;
        // Flush telemetry immediately when tab hides or user leaves
        flushQueue();
      } else {
        isTabActiveRef.current = true;
        resetIdleTimer();
      }
    };

    const handleWindowBlur = () => {
      isTabActiveRef.current = false;
    };

    const handleWindowFocus = () => {
      isTabActiveRef.current = true;
      resetIdleTimer();
    };

    // User activity listener to resume active state (passive, no main-thread block)
    const handleUserActivity = () => {
      if (!isTabActiveRef.current && !document.hidden) {
        isTabActiveRef.current = true;
      }
      resetIdleTimer();
    };

    // Passive event listeners for interaction tracking
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('scroll', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('mousemove', handleUserActivity, { passive: true });

    // Active Dwell Timer (ticks every 1s when active)
    dwellIntervalRef.current = setInterval(() => {
      if (isTabActiveRef.current && !document.hidden) {
        activeDwellSecondsRef.current += 1;
      }
    }, 1000);

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (dwellIntervalRef.current) clearInterval(dwellIntervalRef.current);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
    };
  }, [flushQueue]);

  // 2. IntersectionObserver Sensor: Track visibility depth across tagged elements
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const sensorId = element.dataset.sensorId || element.id || 'unnamed-element';
            
            pushEvent({
              sensor: 'velocity',
              sensorId,
              metric: 'viewport_visibility',
              value: {
                intersectionRatio: Math.round(entry.intersectionRatio * 100),
                timeRatio: entry.time,
              },
            });
          }
        });
      },
      {
        threshold: [0.5, 1.0], // 50% and 100% viewport visibility
      }
    );

    // Observe all DOM elements with [data-sensor-id]
    const elements = document.querySelectorAll('[data-sensor-id]');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [pushEvent]);

  // 3. Intent Hover & Micro-Interaction Listeners (Passive)
  useEffect(() => {
    let hoverStart = 0;
    let hoverTarget: HTMLElement | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a, button, [data-sensor-id]') as HTMLElement;
      if (target) {
        hoverStart = Date.now();
        hoverTarget = target;
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (hoverTarget && hoverStart > 0) {
        const dwellTime = Date.now() - hoverStart;
        // High-signal intent metric: >150ms hover dwell before mouse exit/click
        if (dwellTime >= 150) {
          const sensorId = hoverTarget.dataset.sensorId || hoverTarget.tagName;
          pushEvent({
            sensor: 'intent_hover',
            sensorId,
            metric: 'hover_dwell_ms',
            value: dwellTime,
          });
        }
      }
      hoverStart = 0;
      hoverTarget = null;
    };

    // Text copy micro-interaction tracking
    const handleCopy = () => {
      pushEvent({
        sensor: 'interaction_depth',
        metric: 'text_copy',
        value: 1,
      });
    };

    window.addEventListener('mouseover', handleMouseOver, { passive: true });
    window.addEventListener('mouseout', handleMouseOut, { passive: true });
    window.addEventListener('copy', handleCopy, { passive: true });
    window.addEventListener('pagehide', flushQueue);

    return () => {
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('pagehide', flushQueue);
    };
  }, [pushEvent, flushQueue]);

  return {
    pushEvent,
    flushQueue,
    getActiveDwellTime: () => activeDwellSecondsRef.current,
  };
}

export default useBehavioralTelemetry;
