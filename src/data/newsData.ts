
export type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "lagos-fashion" | "nigerian-tech" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "entertainment" | "news" | "general";

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  category: CategoryType;
  image: string;
  readTime: string;
  date: string;
  href?: string;
  source?: 'static' | 'user' | 'admin'; // Added for admin dashboard
  originalSource?: 'static'; // Added for tracking converted articles
  contentType?: 'article' | 'feature' | 'headline' | 'announcement'; // Content type for admin management
  status?: 'published' | 'draft' | 'scheduled'; // Status for content lifecycle
  featured?: boolean; // Featured content for headlines
  author?: string; // Author information
  content?: string; // Full article content
  externalLink?: string; // External video link for "See Full Video" button
}

export const latestStories: NewsItem[] = [];

export const nigeriaNews: NewsItem[] = [];
