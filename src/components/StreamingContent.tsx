/**
 * Streaming Content Wrapper
 * Progressive loading with skeletons for slow connections
 */

import { ReactNode, Suspense, lazy, useState, useEffect, useRef } from "react";
import React from "react";

// Skeleton components
export function NewsCardSkeleton() {
  return (
    <article className="bg-card rounded-xl overflow-hidden border border-border animate-pulse">
      <div className="relative h-48 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
      <div className="p-5 space-y-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-4" />
      </div>
    </article>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-96 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse">
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-8 left-8 right-8 space-y-4">
        <div className="h-8 bg-white/20 rounded w-3/4" />
        <div className="h-4 bg-white/20 rounded w-1/2" />
        <div className="h-10 bg-white/20 rounded w-32" />
      </div>
    </div>
  );
}

export function ScoreCardSkeleton() {
  return (
    <div className="bg-white/10 rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-white/20 rounded w-1/3" />
        <div className="h-6 bg-white/20 rounded w-16" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 bg-white/20 rounded-full" />
          <div className="h-8 w-12 bg-white/20 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 bg-white/20 rounded-full" />
          <div className="h-8 w-12 bg-white/20 rounded" />
        </div>
      </div>
    </div>
  );
}

// Streaming Section with Suspense
interface StreamingSectionProps {
  children: ReactNode;
  fallback?: ReactNode;
  priority?: "high" | "medium" | "low";
}

export function StreamingSection({
  children,
  fallback,
  priority = "medium",
}: StreamingSectionProps) {
  const showFallback = fallback ?? getDefaultFallback(priority);
  return <Suspense fallback={showFallback}>{children}</Suspense>;
}

function getDefaultFallback(priority: string): ReactNode {
  switch (priority) {
    case "high":
      return <HeroSkeleton />;
    case "medium":
      return <NewsCardSkeleton />;
    default:
      return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }
}

// Progressive content loader
interface ProgressiveContentProps {
  content: ReactNode;
  placeholder?: ReactNode;
  threshold?: number;
  rootMargin?: string;
}

export function ProgressiveContent({
  content,
  placeholder,
  threshold = 0,
  rootMargin = "100px",
}: ProgressiveContentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return (
    <div ref={containerRef}>
      {isVisible ? content : placeholder ?? <NewsCardSkeleton />}
    </div>
  );
}

// Lazy load component
export function useLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(importFn);
}

// Deferred content
interface DeferredContentProps {
  children: ReactNode;
  fallback?: ReactNode;
  delay?: number;
}

export function DeferredContent({
  children,
  fallback,
  delay = 300,
}: DeferredContentProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldRender(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return shouldRender ? <>{children}</> : <>{fallback ?? <NewsCardSkeleton />}</>;
}

// Error boundary
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">Unable to load content</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
