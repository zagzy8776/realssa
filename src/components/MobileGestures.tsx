import { useState, useEffect, useRef } from 'react';

interface MobileGesturesProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDoubleTap?: () => void;
  className?: string;
}

const MobileGestures = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  onSwipeUp, 
  onSwipeDown, 
  onDoubleTap, 
  className = '' 
}: MobileGesturesProps) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [lastTap, setLastTap] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;
  const maxTapTime = 300;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      setTouchEnd(null);
      setTouchStart({
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      setTouchEnd({
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      });
    };

    const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) return;

      const distanceX = touchStart.x - touchEnd.x;
      const distanceY = touchStart.y - touchEnd.y;
      const absDistanceX = Math.abs(distanceX);
      const absDistanceY = Math.abs(distanceY);

      if (Math.max(absDistanceX, absDistanceY) < minSwipeDistance) {
        return;
      }

      if (absDistanceX > absDistanceY) {
        if (distanceX > 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      } else {
        if (distanceY > 0) {
          onSwipeUp?.();
        } else {
          onSwipeDown?.();
        }
      }

      setTouchStart(null);
      setTouchEnd(null);
    };

    const handleDoubleTap = (e: TouchEvent) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < maxTapTime && tapLength > 0) {
        e.preventDefault();
        onDoubleTap?.();
      }
      
      setLastTap(currentTime);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd);
      container.addEventListener('touchend', handleDoubleTap);
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchend', handleDoubleTap);
      }
    };
  }, [touchStart, touchEnd, lastTap, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onDoubleTap]);

  return (
    <div 
      ref={containerRef}
      className={`touch-pan-y touch-pinch-zoom ${className}`}
      style={{ 
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y pinch-zoom'
      }}
    >
      {children}
    </div>
  );
};

export default MobileGestures;