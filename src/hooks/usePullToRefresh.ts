import { useRef } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

/**
 * Intentionally inert on the web/mobile touch layer.
 * Native browser pull-to-refresh and normal scrolling are left untouched.
 * The previous document-level touch interception could interfere with taps,
 * swipes, carousels, and nested scrolling.
 */
export const usePullToRefresh = (_options: UsePullToRefreshOptions) => {
  const isPulling = useRef(false);
  const pullDistance = useRef(0);
  const refreshTriggered = useRef(false);

  return {
    isPulling: isPulling.current,
    pullDistance: pullDistance.current,
    refreshTriggered: refreshTriggered.current,
  };
};
