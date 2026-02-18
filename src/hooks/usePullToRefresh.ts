import { useEffect, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

export const usePullToRefresh = ({ onRefresh, threshold = 100, disabled = false }: UsePullToRefreshOptions) => {
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const refreshTriggered = useRef(false);
  const pullDistance = useRef(0);
  
  // Elements refs
  const pullIndicator = useRef<HTMLDivElement>(null);
  const pullContainer = useRef<HTMLDivElement>(null);

  const updatePullIndicator = useCallback((distance: number) => {
    if (!pullIndicator.current) return;
    
    const maxDistance = threshold;
    const progress = Math.min(distance / maxDistance, 1);
    
    // Update indicator position and opacity
    pullIndicator.current.style.transform = `translateY(${distance}px)`;
    pullIndicator.current.style.opacity = progress.toString();
    
    // Rotate indicator based on progress
    const rotation = progress * 180;
    pullIndicator.current.style.transform = `translateY(${distance}px) rotate(${rotation}deg)`;
  }, [threshold]);

  const resetPullIndicator = useCallback(() => {
    if (!pullIndicator.current || !pullContainer.current) return;
    
    pullIndicator.current.style.transition = 'all 0.3s ease-out';
    pullIndicator.current.style.transform = 'translateY(0) rotate(0deg)';
    pullIndicator.current.style.opacity = '0';
    
    pullContainer.current.style.transition = 'transform 0.3s ease-out';
    pullContainer.current.style.transform = 'translateY(0)';
    
    // Reset after animation
    setTimeout(() => {
      if (pullIndicator.current && pullContainer.current) {
        pullIndicator.current.style.transition = '';
        pullContainer.current.style.transition = '';
      }
    }, 300);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshTriggered.current) return;
    
    const target = e.target as HTMLElement;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Only allow pull-to-refresh when at the top of the page
    if (scrollTop > 0) return;
    
    // Check if user is touching a scrollable element
    const scrollableElement = target.closest('.no-pull-to-refresh');
    if (scrollableElement) return;

    isPulling.current = true;
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    pullDistance.current = 0;
    
    // Show pull indicator
    if (pullIndicator.current) {
      pullIndicator.current.style.opacity = '1';
      pullIndicator.current.style.display = 'block';
    }
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || disabled || refreshTriggered.current) return;
    
    currentY.current = e.touches[0].clientY;
    pullDistance.current = currentY.current - startY.current;
    
    // Only allow downward pull
    if (pullDistance.current <= 0) {
      pullDistance.current = 0;
      return;
    }
    
    // Limit maximum pull distance
    const maxPull = threshold * 2;
    const clampedDistance = Math.min(pullDistance.current, maxPull);
    
    updatePullIndicator(clampedDistance);
    
    // Move container with finger
    if (pullContainer.current) {
      pullContainer.current.style.transform = `translateY(${clampedDistance}px)`;
    }
    
    // Trigger refresh when threshold is reached
    if (pullDistance.current >= threshold && !refreshTriggered.current) {
      refreshTriggered.current = true;
      triggerRefresh();
    }
  }, [disabled, threshold, updatePullIndicator]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    
    isPulling.current = false;
    refreshTriggered.current = false;
    
    resetPullIndicator();
  }, [resetPullIndicator]);

  const triggerRefresh = useCallback(async () => {
    if (!pullIndicator.current) return;
    
    // Show loading state
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
      // Reset after short delay
      setTimeout(() => {
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

  useEffect(() => {
    // Create pull indicator element
    const indicator = document.createElement('div');
    indicator.id = 'pull-to-refresh-indicator';
    indicator.className = 'fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-200 opacity-0';
    indicator.innerHTML = `
      <div class="flex flex-col items-center space-y-2 text-muted-foreground">
        <div class="text-2xl">↓</div>
        <span class="text-xs">Pull to refresh</span>
      </div>
    `;
    
    // Create pull container
    const container = document.createElement('div');
    container.id = 'pull-to-refresh-container';
    container.className = 'relative';
    
    // Insert elements
    document.body.appendChild(indicator);
    document.body.insertBefore(container, document.body.firstChild);
    
    // Set refs
    pullIndicator.current = indicator;
    pullContainer.current = container;
    
    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    // Initial setup
    resetPullIndicator();
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, resetPullIndicator]);

  return {
    isPulling: isPulling.current,
    pullDistance: pullDistance.current,
    refreshTriggered: refreshTriggered.current
  };
};