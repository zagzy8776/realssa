import { Card, CardContent } from "@/components/ui/card";

const NewsCardSkeleton = () => {
  return (
    <article className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
      <div className="relative h-48 overflow-hidden">
        {/* Image Skeleton */}
        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-card" />
        
        {/* Category Badge Skeleton */}
        <div className="absolute top-3 left-3">
          <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="p-5 space-y-3">
        {/* Title Skeleton */}
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
        
        {/* Excerpt Skeleton */}
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6 animate-pulse" />
        
        {/* Metadata Skeleton */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse" />
        </div>

        {/* External Video Link Button Skeleton */}
        <div className="mt-4">
          <div className="w-32 h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
        </div>
      </div>
    </article>
  );
};

export default NewsCardSkeleton;