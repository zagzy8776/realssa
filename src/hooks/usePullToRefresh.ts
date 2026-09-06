import { useEffect, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

// Disabled on touch devices because global document-level touch listeners can
// interfere with native scrolling, taps, carousels, and browser gestures.
const PULL_TO_REFRESH_ENABLED = false;

export const usePullToRefresh = ({ onRefresh, threshold = 100, disabled = false }: UsePullToRefreshOptions) => {
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const refreshTriggered = useRef(false);
  const pullDistance = useRef(0);

  const pullIndicator = useRef<HTMLDivElement>(null);
  const pullContainer = useRef<HTMLDivElement>(null);

  const updatePullIndicator = useCallback((distance: number) => {
    if (!pullIndicator.current) return;

    const maxDistance = threshold;
    const progress = Math.min(distance / maxDistance, 1);
    pullIndicator.current.style.transform = `translateY(${distance}px) rotate(${progress * 180}deg)`;
    pullIndicator.current.style.opacity = progress.toString();
  }, [threshold]);

  const resetPullIndicator = useCallback(() => {
    if (!pullIndicator.current || !pullContainer.current) return;

    pullIndicator.current.style.transition = 'all 0.3s ease-out';
    pullIndicator.current.style.transform = 'translateY(0) rotate(0deg)';
    pullIndicator.current.style.opacity = '0';
    pullContainer.current.style.transition = 'transform 0.3s ease-out';
    pullContainer.current.style.transform = 'translateY(0)';

    window.setTimeout(() => {
      if (pullIndicator.current && pullContainer.current) {
        pullIndicator.current.style.transition = '';
        pullContainer.current.style.transition = '';
      }
    }, 300);
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (!pullIndicator.current) return;

    pullIndicator.current.innerHTML = `
      <div class="flex items-center justify-center space-x-2">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span class="text-sm text-muted-foreground">Refreshing...</span>
      </div>
    `;

    try {
      await onRefresh();
    } catch (error) {
      console.error('Pull to refresh failed:', error);
    } finally {
      window.setTimeout(() => {
        if (pullIndicator.current) {
          pullIndicator.current.innerHTML = `
            <div class="flex flex-col items-center space-y-2 text-muted-foreground">
              <div class="text-2xl">↓</div>
              <span class="text-xs">Pull to refresh</span>
            </div>
          `;
        }
        resetPullIndicator();
      }, 1000);
    }
  }, [onRefresh, resetPullIndicator]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!PULL_TO_REFRESH_ENABLED || disabled || refreshTriggered.current) return;

    const target = e.target as HTMLElement;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > 0) return;

    if (target.closest('.no-pull-to-refresh, .swiper')) return;

    isPulling.current = true;
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    pullDistance.current = 0;

    if (pullIndicator.current) {
      pullIndicator.current.style.opacity = '1';
      pullIndicator.current.style.display = 'block';
    }
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!PULL_TO_REFRESH_ENABLED || !isPulling.current || disabled || refreshTriggered.current) return;

    currentY.current = e.touches[0].clientY;
    pullDistance.current = currentY.current - startY.current;

    if (pullDistance.current <= 0) {
      pullDistance.current = 0;
      return;
    }

    const maxPull = threshold * 2;
    const clampedDistance = Math.min(pullDistance.current, maxPull);
    updatePullIndicator(clampedDistance);

    if (pullContainer.current) {
      pullContainer.current.style.transform = `translateY(${clampedDistance}px)`;
    }

    if (pullDistance.current >= threshold && !refreshTriggered.current) {
      refreshTriggered.current = true;
      void triggerRefresh();
    }
  }, [disabled, threshold, updatePullIndicator, triggerRefresh]);

  const handleTouchEnd = useCallback(() => {
    if (!PULL_TO_REFRESH_ENABLED || !isPulling.current) return;

    isPulling.current = false;
    refreshTriggered.current = false;
    resetPullIndicator();
  }, [resetPullIndicator]);

  useEffect(() => {
    // Keep this hook inert until pull-to-refresh is redesigned around native
    // browser gestures rather than document-level touch interception.
    if (!PULL_TO_REFRESH_ENABLED) return;

    const indicator = document.createElement('div');
    indicator.id = 'pull-to-refresh-indicator';
    indicator.className = 'fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-200 opacity-0';
    indicator.innerHTML = `
      <div class="flex flex-col items-center space-y-2 text-muted-foreground">
        <div class="text-2xl">↓</div>
        <span class="text-xs">Pull to refresh</span>
      </div>
    `;

    const container = document.createElement('div');
    container.id = 'pull-to-refresh-container';
    container.className = 'relative';

    document.body.appendChild(indicator);
    document.body.insertBefore(container, document.body.firstChild);
    pullIndicator.current = indicator;
    pullContainer.current = container;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    resetPullIndicator();

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      if (indicator.parentNode) indicator.parentNode.removeChild(indicator);
      if (container.parentNode) container.parentNode.removeChild(container);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, resetPullIndicator]);

  return {
    isPulling: isPulling.current,
    pullDistance: pullDistance.current,
    refreshTriggered: refreshTriggered.current,
  };
};
