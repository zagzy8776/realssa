import React, { useState, useRef, useEffect } from 'react';
import BrandLoader from './BrandLoader';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const MAX_PULL = 120;
  const THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || isRefreshing) return;
    
    // Ignore touch starts inside Swiper elements to prevent conflict
    const target = e.target as HTMLElement;
    if (target.closest('.no-pull-to-refresh, .swiper')) return;

    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;

    // Only pull if scrolling down from the top
    if (delta > 0 && window.scrollY <= 0) {
      // Add friction
      const pullDistance = Math.min(delta * 0.5, MAX_PULL);
      setPullY(pullDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullY >= THRESHOLD) {
      setIsRefreshing(true);
      setPullY(THRESHOLD); // Snap to loading position
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  };

  // Prevent default scroll behavior natively when pulling
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (isPulling.current && window.scrollY <= 0) {
        e.preventDefault();
      }
    };
    // must be passive: false to allow e.preventDefault()
    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => {
      document.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  return (
    <div 
      className="pull-to-refresh-container relative w-full h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Custom Pull Indicator */}
      <div 
        className="absolute top-0 left-0 w-full flex justify-center items-end overflow-hidden transition-all duration-200 ease-out z-50 pointer-events-none"
        style={{ 
          height: pullY > 0 || isRefreshing ? `${Math.max(pullY, isRefreshing ? THRESHOLD : 0)}px` : '0px',
          opacity: pullY > 20 || isRefreshing ? 1 : 0
        }}
      >
        <div className="pb-4 transform scale-75 origin-bottom">
          <BrandLoader size="inline" />
        </div>
      </div>

      {/* Main Content pushed down */}
      <div 
        className="transition-transform duration-200 ease-out h-full"
        style={{ transform: `translateY(${pullY > 0 || isRefreshing ? Math.max(pullY, isRefreshing ? THRESHOLD : 0) : 0}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
