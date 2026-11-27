import React, { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";

/**
 * Modern page transitions for RealSSA
 * - Direction-aware slide (forward / back)
 * - Soft fade + lift for same-level routes
 * - Respects prefers-reduced-motion
 * - Shared layout chrome stays outside this wrapper
 */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

type Direction = "forward" | "back" | "none";

function pathDepth(path: string) {
  return path.split("/").filter(Boolean).length;
}

function getDirection(
  from: string,
  to: string,
  navType: "POP" | "PUSH" | "REPLACE"
): Direction {
  if (navType === "POP") return "back";
  if (navType === "REPLACE") return "none";

  const fromDepth = pathDepth(from);
  const toDepth = pathDepth(to);

  if (to === "/" && from !== "/") return "back";
  if (from === "/" && to !== "/") return "forward";

  if (toDepth > fromDepth) return "forward";
  if (toDepth < fromDepth) return "back";
  return "none";
}

const fadeLift = {
  initial: { opacity: 0, y: 14, filter: "blur(4px)" },
  enter: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.38, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(3px)",
    transition: { duration: 0.22, ease: EASE_IN },
  },
};

const slideForward = {
  initial: { opacity: 0, x: 28 },
  enter: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    x: -18,
    transition: { duration: 0.24, ease: EASE_IN },
  },
};

const slideBack = {
  initial: { opacity: 0, x: -28 },
  enter: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    x: 18,
    transition: { duration: 0.24, ease: EASE_IN },
  },
};

const reduced = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

interface PageTransitionProps {
  /** "auto" picks slide vs fade from navigation direction */
  type?: "auto" | "fade" | "slide" | "fadeScale";
  className?: string;
  enabled?: boolean;
}

export const PageTransition = ({
  type = "auto",
  className = "",
  enabled = true,
}: PageTransitionProps) => {
  const location = useLocation();
  const navType = useNavigationType();
  const prefersReduced = useReducedMotion();
  const prevPath = useRef(location.pathname);

  const direction = useMemo(() => {
    return getDirection(prevPath.current, location.pathname, navType);
  }, [location.pathname, navType]);

  useEffect(() => {
    prevPath.current = location.pathname;
  }, [location.pathname]);

  const variants = useMemo(() => {
    if (prefersReduced) return reduced;

    if (type === "fade" || type === "fadeScale") return fadeLift;
    if (type === "slide") {
      return direction === "back" ? slideBack : slideForward;
    }

    // auto
    if (direction === "forward") return slideForward;
    if (direction === "back") return slideBack;
    return fadeLift;
  }, [type, direction, prefersReduced]);

  if (!enabled) {
    return <Outlet />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={variants}
        className={`w-full min-h-[50vh] ${className}`}
        style={{
          position: "relative",
          width: "100%",
          willChange: "opacity, transform",
        }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Shared layout wrapper for elements that should morph between routes
 */
export const PageTransitionLayout = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.div
      className={className}
      layout
      transition={{ duration: 0.35, ease: EASE_OUT }}
      style={{ width: "100%" }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Hook: current navigation direction for custom UI
 */
export function useNavigationDirection(): Direction {
  const location = useLocation();
  const navType = useNavigationType();
  const prev = useRef(location.pathname);
  const dir = useRef<Direction>("none");

  useEffect(() => {
    dir.current = getDirection(prev.current, location.pathname, navType);
    prev.current = location.pathname;
  }, [location.pathname, navType]);

  return dir.current;
}

/** Stagger helpers for list / card grids inside a page */
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
};

/**
 * Optional: wrap page content so children stagger in after the route transition
 */
export const StaggeredPageTransition = ({
  className = "",
}: {
  className?: string;
}) => {
  const location = useLocation();
  const prefersReduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={prefersReduced ? reduced : staggerContainer}
        initial="hidden"
        animate="show"
        exit="hidden"
        className={`w-full ${className}`}
        style={{ position: "relative", width: "100%" }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};
