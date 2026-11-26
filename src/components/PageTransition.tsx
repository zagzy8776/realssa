import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

/**
 * Page transition variants for different transition types
 */
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom cubic-bezier for natural feel
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 1.02,
    transition: {
      duration: 0.25,
      ease: [0.55, 0.055, 0.675, 0.19],
    },
  },
};

/**
 * Slide transition variants (horizontal slide based on navigation direction)
 */
const slideVariants = (direction: 'left' | 'right') => ({
  initial: {
    opacity: 0,
    x: direction === 'left' ? 30 : -30,
  },
  enter: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    x: direction === 'left' ? -30 : 30,
    transition: {
      duration: 0.3,
      ease: [0.55, 0.055, 0.675, 0.19],
    },
  },
});

/**
 * Fade + scale transition for modals/overlays
 */
const fadeScaleVariants = {
  initial: { opacity: 0, scale: 0.95 },
  enter: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: 'easeIn' }
  },
};

/**
 * Determines navigation direction based on path depth
 * Deeper paths = forward (slide left), shallower = back (slide right)
 */
function getNavigationDirection(fromPath: string, toPath: string): 'left' | 'right' {
  const fromDepth = fromPath.split('/').filter(Boolean).length;
  const toDepth = toPath.split('/').filter(Boolean).length;

  // Special cases for known navigation patterns
  if (fromPath === '/' && toPath !== '/') return 'left';
  if (toPath === '/' && fromPath !== '/') return 'right';

  return toDepth > fromDepth ? 'left' : 'right';
}

interface PageTransitionProps {
  /** Transition type: 'fade' | 'slide' | 'fadeScale' */
  type?: 'fade' | 'slide' | 'fadeScale';
  /** Custom className for the container */
  className?: string;
  /** Whether to enable transitions (can be disabled for specific routes) */
  enabled?: boolean;
}

export const PageTransition = ({
  type = 'fade',
  className = '',
  enabled = true,
}: PageTransitionProps) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Memoize the direction to prevent unnecessary recalculations
  const direction = useMemo(() => {
    // We can't easily get previous location in React Router v6 without extra setup
    // For now, we'll use path depth as a heuristic
    return 'left';
  }, [pathname]);

  // Select variants based on type
  const variants = useMemo(() => {
    switch (type) {
      case 'slide':
        return slideVariants(direction);
      case 'fadeScale':
        return fadeScaleVariants;
      default:
        return pageVariants;
    }
  }, [type, direction]);

  if (!enabled) {
    return <Outlet />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={variants}
        className={`w-full ${className}`}
        style={{ position: 'relative', width: '100%' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Layout-level transition wrapper that provides shared layout animations
 * Use this at the router level for shared element transitions
 */
export const PageTransitionLayout = ({
  children,
  className = '',
}: { children: React.ReactNode; className?: string }) => {
  return (
    <motion.div
      className={className}
      layout
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Hook to track navigation direction for smarter transitions
 */
export function useNavigationDirection() {
  const location = useLocation();
  const prevPathRef = React.useRef<string>('/');
  const directionRef = React.useRef<'left' | 'right'>('left');

  React.useEffect(() => {
    const currentPath = location.pathname;
    directionRef.current = getNavigationDirection(prevPathRef.current, currentPath);
    prevPathRef.current = currentPath;
  }, [location.pathname]);

  return directionRef.current;
}

// Need to import React for the hook
import React from 'react';

/**
 * Staggered children animation for lists/grids entering with page
 */
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/**
 * Page transition with staggered children for content-heavy pages
 */
export const StaggeredPageTransition = ({
  className = '',
}: { className?: string }) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        exit="hidden"
        className={`w-full ${className}`}
        style={{ position: 'relative', width: '100%' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};