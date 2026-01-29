import { cn } from "@/lib/utils";

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "breaking" | "news" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "lagos-fashion" | "nigerian-tech" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "entertainment" | "general";

interface CategoryBadgeProps {
  category: CategoryType;
  className?: string;
}

const categoryStyles: Record<CategoryType, string> = {
  afrobeats: "bg-afrobeats text-primary-foreground",
  nollywood: "bg-nollywood text-primary-foreground",
  culture: "bg-culture text-primary-foreground",
  fashion: "bg-fashion text-primary-foreground",
  tech: "bg-tech text-primary-foreground",
  music: "bg-music text-primary-foreground",
  breaking: "bg-secondary text-secondary-foreground animate-pulse-glow",
  news: "bg-blue-500 text-white",
  "nigerian-news": "bg-orange-500 text-white",
  "nigerian-gaming": "bg-green-500 text-white",
  "crypto-nigeria": "bg-purple-500 text-white",
  "lagos-fashion": "bg-pink-500 text-white",
  "nigerian-tech": "bg-indigo-500 text-white",
  "nigerian-sports": "bg-red-500 text-white",
  "nigerian-politics": "bg-gray-500 text-white",
  "nigerian-business": "bg-yellow-500 text-black",
  "nigerian-lifestyle": "bg-teal-500 text-white",
  entertainment: "bg-orange-500 text-white",
  general: "bg-gray-400 text-white",
};

const categoryLabels: Record<CategoryType, string> = {
  afrobeats: "Afrobeats",
  nollywood: "Nollywood",
  culture: "Culture",
  fashion: "Fashion",
  tech: "Tech",
  music: "Music",
  breaking: "Breaking News",
  news: "News",
  "nigerian-news": "Nigerian News",
  "nigerian-gaming": "Nigerian Gaming",
  "crypto-nigeria": "Crypto Nigeria",
  "lagos-fashion": "Lagos Fashion",
  "nigerian-tech": "Nigerian Tech",
  "nigerian-sports": "Nigerian Sports",
  "nigerian-politics": "Nigerian Politics",
  "nigerian-business": "Nigerian Business",
  "nigerian-lifestyle": "Nigerian Lifestyle",
  entertainment: "Entertainment",
  general: "General",
};

const CategoryBadge = ({ category, className }: CategoryBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full",
        categoryStyles[category],
        className
      )}
    >
      {categoryLabels[category]}
    </span>
  );
};

export default CategoryBadge;
