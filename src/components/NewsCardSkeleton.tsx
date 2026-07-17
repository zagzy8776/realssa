import { Card, CardContent } from "@/components/ui/card";

const NewsCardSkeleton = () => {
  return (
    <article 
      className="group overflow-hidden transition-all duration-300 w-full"
      style={{
        backgroundColor: '#211D26',
        borderRadius: '0px',
        border: 'none',
        boxShadow: 'none'
      }}
    >
      {/* Category Eyebrow Badge Skeleton */}
      <div className="flex items-center gap-1.5 px-4 pt-[14px] pb-0">
        <div className="w-16 h-3 bg-[#2C2732] rounded animate-pulse" />
      </div>

      {/* 16:9 Image container */}
      <div className="px-4 pt-2 pb-0 w-full">
        <div 
          className="relative w-full aspect-video rounded-[6px] overflow-hidden flex items-center justify-center animate-pulse"
          style={{ backgroundColor: '#2C2732' }}
        >
          {/* Image Skeleton */}
          <div className="w-full h-full bg-gradient-to-r from-[#2C2732] via-[#362F3D] to-[#2C2732]" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="px-4 pt-3 pb-1 space-y-2">
        {/* Title Skeleton */}
        <div className="h-5 bg-[#2C2732] rounded animate-pulse w-5/6" />
        <div className="h-5 bg-[#2C2732] rounded animate-pulse w-2/3" />
      </div>
      
      {/* Excerpt Skeleton */}
      <div className="px-4 pt-0 pb-3 space-y-2">
        <div className="h-3.5 bg-[#2C2732] rounded animate-pulse w-full" />
        <div className="h-3.5 bg-[#2C2732] rounded animate-pulse w-4/5" />
      </div>

      {/* Thin hairline divider */}
      <div className="mx-4 border-t-[0.5px] border-[#362F3D]" />

      {/* Metadata Skeleton */}
      <div className="px-4 pt-2.5 pb-3.5 flex items-center justify-between gap-4">
        <div className="h-3 bg-[#2C2732] rounded w-28 animate-pulse" />
        <div className="flex items-center gap-3.5">
          <div className="w-4 h-4 bg-[#2C2732] rounded animate-pulse" />
          <div className="w-4 h-4 bg-[#2C2732] rounded animate-pulse" />
        </div>
      </div>
    </article>
  );
};

export default NewsCardSkeleton;
