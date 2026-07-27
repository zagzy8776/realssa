import { Card, CardContent } from "@/components/ui/card";

const NewsCardSkeleton = () => {
  return (
    <article 
      className="group glass-card overflow-hidden transition-all duration-300 w-full"
      style={{ borderRadius: '12px' }}
    >
      {/* Category Eyebrow Badge Skeleton */}
      <div className="flex items-center gap-1.5 px-4 pt-[14px] pb-0">
        <div className="w-16 h-3 rounded glass-skeleton" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* 16:9 Image container */}
      <div className="px-4 pt-2 pb-0 w-full">
          <div 
            className="relative w-full aspect-video rounded-[6px] overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(44, 39, 50, 0.5)' }}
          >
            {/* Image Skeleton */}
            <div className="w-full h-full glass-skeleton" />
          </div>
      </div>

      {/* Content Skeleton */}
      <div className="px-4 pt-3 pb-1 space-y-2">
        {/* Title Skeleton */}
        <div className="h-5 rounded glass-skeleton w-5/6" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-5 rounded glass-skeleton w-2/3" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
      
      {/* Excerpt Skeleton */}
      <div className="px-4 pt-0 pb-3 space-y-2">
        <div className="h-3.5 rounded glass-skeleton w-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="h-3.5 rounded glass-skeleton w-4/5" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* Thin hairline divider */}
      <div className="mx-4 border-t-[0.5px]" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Metadata Skeleton */}
      <div className="px-4 pt-2.5 pb-3.5 flex items-center justify-between gap-4">
        <div className="h-3 rounded w-28 glass-skeleton" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex items-center gap-3.5">
          <div className="w-4 h-4 rounded glass-skeleton" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="w-4 h-4 rounded glass-skeleton" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
      </div>
    </article>
  );
};

export default NewsCardSkeleton;
