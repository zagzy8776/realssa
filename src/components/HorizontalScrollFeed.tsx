import { useRef } from "react";
import { Link } from "react-router-dom";
import EnhancedImage from "./EnhancedImage";
import CategoryBadge from "./CategoryBadge";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Article {
  id: string;
  title: string;
  category: any;
  image: string;
  date: string;
  externalLink?: string;
}

interface HorizontalScrollFeedProps {
  title: string;
  articles: Article[];
}

const HorizontalScrollFeed = ({ title, articles }: HorizontalScrollFeedProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!articles || articles.length === 0) return null;

  return (
    <section className="py-6 w-full overflow-hidden">
      <div className="container mx-auto px-4 mb-4 flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2">
          <span className="w-2 h-6 bg-primary rounded-full inline-block"></span>
          {title}
        </h2>
        
        {/* Desktop Navigation Arrows */}
        <div className="hidden md:flex gap-2">
          <button 
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* The Scrollable Container */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 px-4 md:px-8 pb-6 pt-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {articles.map((article) => {
          const isExternal = !!article.externalLink;
          const linkTo = isExternal ? article.externalLink : `/article/${article.id}`;
          const className = "group relative flex-none w-[280px] md:w-[320px] aspect-[4/5] rounded-2xl overflow-hidden snap-center md:snap-start shrink-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1";
          
          const CardContent = (
            <>
              <EnhancedImage
                src={article.image}
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col justify-end">
                <div className="mb-3">
                  <CategoryBadge category={article.category} />
                </div>
                <h3 className="text-white font-display font-bold text-lg leading-tight line-clamp-3 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
              </div>
            </>
          );

          return isExternal ? (
            <a 
              href={linkTo}
              target="_blank"
              rel="noopener noreferrer"
              key={article.id}
              className={className}
            >
              {CardContent}
            </a>
          ) : (
            <Link 
              to={linkTo}
              key={article.id}
              className={className}
            >
              {CardContent}
            </Link>
          );
        })}
      </div>
      
      {/* Hide scrollbar CSS injection just for this component */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
};

export default HorizontalScrollFeed;
