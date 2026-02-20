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
    <div className={`bg-white dark:bg-[#16213E] rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Image Skeleton */}
      <div className="relative h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer" 
             style={{ backgroundSize: '200% 100%' }} />
        
        {/* Badge Skeleton */}
        <div className="absolute top-4 left-4">
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse w-20" />
        </div>
      </div>

      {/* Title Skeleton */}
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse w-full" />
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse w-3/4" />

      {/* Excerpt Skeleton */}
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse w-full" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse w-full" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse w-2/3" />

      {/* Footer Skeleton */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
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
