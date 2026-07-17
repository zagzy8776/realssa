import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => Promise<void> | void;
  isLoading?: boolean;
  hasMore?: boolean;
  threshold?: number;
  disabled?: boolean;
}

export const useInfiniteScroll = ({ 
  onLoadMore, 
  isLoading = false, 
  hasMore = true, 
  threshold = 0.1, 
  disabled = false 
}: UseInfiniteScrollOptions) => {
  const observerTarget = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || disabled) return;
    
    try {
      await onLoadMore();
    } catch (error) {
      console.error('Infinite scroll load more failed:', error);
    }
  }, [onLoadMore, isLoading, hasMore, disabled]);

  useEffect(() => {
    if (!observerTarget.current || disabled) return;

    // Debounce the load more function to prevent multiple triggers
    const debouncedLoadMore = () => {
      if (loadMoreTimeout.current) {
        clearTimeout(loadMoreTimeout.current);
      }
      
      loadMoreTimeout.current = setTimeout(() => {
        loadMore();
      }, 100);
    };

    observer.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoading) {
          debouncedLoadMore();
        }
      },
      {
        threshold: threshold,
        rootMargin: '100px' // Start loading before reaching the bottom
      }
    );

    observer.current.observe(observerTarget.current);

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
      if (loadMoreTimeout.current) {
        clearTimeout(loadMoreTimeout.current);
      }
    };
  }, [threshold, hasMore, isLoading, disabled, loadMore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadMoreTimeout.current) {
        clearTimeout(loadMoreTimeout.current);
      }
    };
  }, []);

  return {
    observerTarget,
    isLoading,
    hasMore,
    disabled
  };
};