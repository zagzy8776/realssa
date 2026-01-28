
export type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music";

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
}

export const latestStories: NewsItem[] = [];

export const nigeriaNews: NewsItem[] = [];
