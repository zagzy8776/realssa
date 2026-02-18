import { Clock, Calendar, Bookmark, BookmarkCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import CategoryBadge from "./CategoryBadge";
import EnhancedImage from "./EnhancedImage";


type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "nollywood" | "lagos-fashion" | "nigerian-tech" | "entertainment" | "news" | "general";

interface NewsCardProps {
  title: string;
  excerpt: string;
  category: CategoryType;
  image: string;
  readTime: string;
  date: string;
  href?: string;
  id?: string;
  externalLink?: string;
  onRead?: (articleId: string) => void;
  onBookmark?: (articleId: string) => void;
  showBookmark?: boolean;
}

const NewsCard = ({
  title,
  excerpt,
  category,
  image,
  readTime,
  date,
  href,
  id,
  externalLink,
  onRead,
  onBookmark,
  showBookmark = true,
}: NewsCardProps) => {
  const { toast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  // Check if article is bookmarked on mount
  useEffect(() => {
    if (id) {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      setIsBookmarked(bookmarks.includes(id));
    }
  }, [id]);

  // Use React Router Link if we have an ID, otherwise use regular link
  const linkTo = href || (id ? `/article/${id}` : "#");
  
  // For external links, we want to show a preview page first
  const handleReadMore = (e: React.MouseEvent) => {
    if (externalLink) {
      e.preventDefault();
      // For external RSS articles, navigate to article page first
      if (id) {
        window.location.href = `/article/${id}`;
      } else {
        // Fallback to external link
        window.open(externalLink, '_blank', 'noopener,noreferrer');
      }
    } else if (onRead && id) {
      onRead(id);
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    let newBookmarks;
    
    if (isBookmarked) {
      newBookmarks = bookmarks.filter((bookmarkId: string) => bookmarkId !== id);
      toast({
        title: "Bookmark removed",
        description: "Article removed from your bookmarks",
      });
    } else {
      newBookmarks = [...bookmarks, id];
      toast({
        title: "Bookmark added",
        description: "Article saved to your bookmarks",
      });
    }
    
    localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
    setIsBookmarked(!isBookmarked);
    
    // Call parent handler if provided
    if (onBookmark) {
      onBookmark(id);
    }
  };


  return (
    <article className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-primary/50 dark:hover:border-primary/30 transition-all duration-300 hover:shadow-lg dark:hover:shadow-gray-900/50 flex flex-col h-full">


      <Link to={linkTo} className="block" onClick={handleReadMore}>
        {/* 1. Image with Fixed Aspect Ratio */}
        <div className="aspect-video w-full overflow-hidden bg-zinc-100 dark:bg-gray-900 relative">

          <EnhancedImage
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            fallback="https://via.placeholder.com/400x250?text=EntertainmentGHC"
          />
          <div className="absolute inset-0 bg-gradient-card" />
          <div className="absolute top-3 left-3">
            <CategoryBadge category={category} />
          </div>
          {showBookmark && (
            <div className="absolute top-3 right-3">
              <button
                onClick={handleBookmark}
                className={`p-2 rounded-full transition-colors shadow-sm ${
                  isBookmarked 
                    ? 'bg-orange-500 text-white hover:bg-orange-600' 
                    : 'bg-white/90 text-gray-700 hover:bg-white'
                }`}
                title={isBookmarked ? "Remove bookmark" : "Bookmark this article"}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

        </div>

        {/* 2. Text Content Box */}
        <div className="p-4 flex flex-col flex-grow">
          {/* Headline: Max 2 lines, then ... */}
          <h3 className="font-display text-sm font-bold leading-tight text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 h-[2.5rem] group-hover:text-primary transition-colors">
            {title}
          </h3>
          
          {/* Summary: Max 3 lines, then ... */}
          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 mb-4 flex-grow">
            {excerpt}
          </p>

          {/* Bottom Metadata */}
          <div className="mt-auto flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400">


            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              {readTime}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={10} />
              {date}
            </span>
          </div>

          {/* External Video Link Button - Fixed to avoid nested links */}
          {externalLink && (
            <div className="mt-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(externalLink, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-medium transition-colors"
              >
                🎬 See Full Video
              </button>
            </div>
          )}
        </div>
      </Link>
    </article>
  );
};

export default NewsCard;
