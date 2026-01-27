import { cn } from "@/lib/utils";

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "breaking";

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
};

const categoryLabels: Record<CategoryType, string> = {
  afrobeats: "Afrobeats",
  nollywood: "Nollywood",
  culture: "Culture",
  fashion: "Fashion",
  tech: "Tech",
  music: "Music",
  breaking: "Breaking News",
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