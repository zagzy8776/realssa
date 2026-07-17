import React from 'react';

interface SkeletonCardProps {
  variant?: 'news' | 'video' | 'compact';
  className?: string;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  variant = 'news',
  className = '' 
}) => {
  if (variant === 'video') {
    return (
      <div className={`group overflow-hidden bg-white dark:bg-[#16213E] rounded-lg border-2 border-transparent ${className}`}>
        {/* Thumbnail Skeleton */}
        <div className="relative aspect-video bg-gray-200 dark:bg-gray-700 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer" 
               style={{ backgroundSize: '200% 100%' }} />
        </div>
        
        <div className="p-4">
          {/* Title Skeleton */}
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse w-1/2" />
          
          {/* Meta Info Skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white dark:bg-[#16213E] rounded-lg p-4 border border-gray-200 dark:border-gray-800 ${className}`}>
        <div className="flex gap-4">
          {/* Image Skeleton */}
          <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse flex-shrink-0" />
          
          {/* Content Skeleton */}
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse w-full" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-3 animate-pulse w-2/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
          </div>
        </div>
      </div>
    );
  }

  // Default news variant
  return (
    <div 
      className={`bg-white dark:bg-[#211D26] rounded-[0px] border border-gray-200 dark:border-none shadow-sm dark:shadow-none ${className}`}
      style={{ padding: 0 }}
    >
      {/* Eyebrow placeholder */}
      <div className="flex items-center gap-1.5 px-4 pt-[14px] pb-0">
        <div className="w-16 h-3 bg-gray-200 dark:bg-[#2C2732] rounded animate-pulse" />
      </div>

      {/* Image Skeleton */}
      <div className="px-4 pt-2 pb-0 w-full">
        <div className="relative w-full aspect-video rounded-[6px] bg-gray-200 dark:bg-[#2C2732] mb-0 animate-pulse overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-[#2C2732] dark:via-[#362F3D] dark:to-[#2C2732] animate-shimmer" 
               style={{ backgroundSize: '200% 100%' }} />
        </div>
      </div>

      {/* Title Skeleton */}
      <div className="px-4 pt-3 pb-1 space-y-2">
        <div className="h-5 bg-gray-200 dark:bg-[#2C2732] rounded animate-pulse w-full" />
        <div className="h-5 bg-gray-200 dark:bg-[#2C2732] rounded animate-pulse w-3/4" />
      </div>

      {/* Excerpt Skeleton */}
      <div className="px-4 pt-0 pb-3 space-y-2">
        <div className="h-3.5 bg-gray-200 dark:bg-[#2C2732] rounded mb-2 animate-pulse w-full" />
        <div className="h-3.5 bg-gray-200 dark:bg-[#2C2732] rounded mb-2 animate-pulse w-full" />
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-100 dark:border-[#362F3D]" />

      {/* Footer Skeleton */}
      <div className="px-4 pt-2.5 pb-3.5 flex items-center justify-between gap-4">
        <div className="h-3 bg-gray-200 dark:bg-[#2C2732] rounded animate-pulse w-24" />
        <div className="h-3 bg-gray-200 dark:bg-[#2C2732] rounded animate-pulse w-20" />
      </div>
    </div>
  );
};

// Skeleton Grid for multiple cards
export const SkeletonGrid: React.FC<{ 
  count?: number; 
  variant?: 'news' | 'video' | 'compact';
  columns?: 1 | 2 | 3;
}> = ({ 
  count = 6, 
  variant = 'news',
  columns = 2 
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-8`}>
      {[...Array(count)].map((_, index) => (
        <SkeletonCard key={index} variant={variant} />
      ))}
    </div>
  );
};

export default SkeletonCard;
