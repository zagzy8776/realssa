import producerStudio from "@/assets/producer-studio.jpg";
import cinemaScene from "@/assets/cinema-scene.jpg";
import fashionRunway from "@/assets/fashion-runway.jpg";
import cultureFestival from "@/assets/culture-festival.jpg";
import techStartup from "@/assets/tech-startup.jpg";
import nollywoodSet from "@/assets/nollywood-set.jpg";
import ghanaianFood from "@/assets/ghanaian-food.jpg";

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

export const nigeriaNews: NewsItem[] = [
  {
    id: "n1",
    title: "Nollywood's Global Dominance Continues in 2026",
    excerpt: "Nigerian films break box office records worldwide as industry sets new standards for African storytelling and production quality.",
    category: "nollywood",
    image: nollywoodSet,
    readTime: "8 min read",
    date: "Jan 25, 2026",
    contentType: "feature",
    status: "published",
    featured: true,
    author: "Admin",
    source: "static",
  },
  {
    id: "n2",
    title: "Nigerian Artists Dominate Global Music Charts",
    excerpt: "From Lagos to London, Nigerian musicians set new records and influence global music trends with their unique Afrobeats sound.",
    category: "afrobeats",
    image: producerStudio,
    readTime: "6 min read",
    date: "Jan 24, 2026",
    contentType: "article",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "n3",
    title: "Lagos Fashion Week 2026 Goes Global",
    excerpt: "Nigerian designers showcase innovative collections that blend traditional aesthetics with contemporary styles, attracting international buyers.",
    category: "fashion",
    image: fashionRunway,
    readTime: "5 min read",
    date: "Jan 24, 2026",
    contentType: "article",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "n4",
    title: "Lagos Tech Scene Revolutionizes Entertainment Industry",
    excerpt: "Nigerian startups develop innovative solutions for music distribution, film production, and digital content creation.",
    category: "tech",
    image: techStartup,
    readTime: "7 min read",
    date: "Jan 23, 2026",
    contentType: "feature",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "n5",
    title: "New Generation of Nigerian Producers Shaping Global Sound",
    excerpt: "Young Nigerian producers gain international recognition for their innovative beats and production techniques.",
    category: "music",
    image: producerStudio,
    readTime: "6 min read",
    date: "Jan 23, 2026",
    contentType: "article",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
];
