import { Clock, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import CategoryBadge from "./CategoryBadge";

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music";

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
}: NewsCardProps) => {
  // Use React Router Link if we have an ID, otherwise use regular link
  const linkTo = href || (id ? `/article/${id}` : "#");
  
  return (
    <article className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
      <Link to={linkTo} className="block">
        {/* Image Container */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-card" />
          <div className="absolute top-3 left-3">
            <CategoryBadge category={category} />
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-display text-lg font-semibold text-card-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {excerpt}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {readTime}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {date}
            </span>
          </div>

          {/* External Video Link Button */}
          {externalLink && (
            <div className="mt-4">
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-sm font-medium transition-colors"
              >
                🎬 See Full Video
              </a>
            </div>
          )}
        </div>
      </Link>
    </article>
  );
};

export default NewsCard;