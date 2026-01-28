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

export const latestStories: NewsItem[] = [
  {
    id: "1",
    title: "Shatta Wale Announces Major Collaboration with International Superstar",
    excerpt: "The dancehall king teams up with global icon for groundbreaking track that promises to redefine African music on world stage.",
    category: "afrobeats",
    image: producerStudio,
    readTime: "5 min read",
    date: "Jan 25, 2026",
    contentType: "article",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "2",
    title: "Ghanaian Film 'The Ancestral Call' Wins Best Picture at Pan-African Film Festival",
    excerpt: "Historic victory for Ghanaian cinema as cultural masterpiece takes top honor, showcasing authentic storytelling and stunning visuals.",
    category: "culture",
    image: cinemaScene,
    readTime: "7 min read",
    date: "Jan 24, 2026",
    contentType: "feature",
    status: "published",
    featured: true,
    author: "Admin",
    source: "static",
  },
  {
    id: "3",
    title: "Best Dressed at the 2025 Ghana Music Awards",
    excerpt: "Fashion icons stole the show with stunning outfits blending traditional kente patterns with modern haute couture designs.",
    category: "fashion",
    image: fashionRunway,
    readTime: "8 min read",
    date: "Jan 24, 2026",
    contentType: "article",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "4",
    title: "New Generation of Ghanaian Artists Redefining Afrobeats Sound",
    excerpt: "Young talents bring fresh perspectives and innovative sounds to the ever-evolving genre, gaining global attention.",
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
    id: "5",
    title: "Traditional Festivals Experience Revival in Modern Ghana",
    excerpt: "Communities across Ghana find innovative ways to celebrate heritage while embracing contemporary values and global audiences.",
    category: "culture",
    image: cultureFestival,
    readTime: "5 min read",
    date: "Jan 23, 2026",
    contentType: "feature",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "6",
    title: "Streaming Platforms Boost Ghanaian Content Visibility",
    excerpt: "Local productions gain international recognition through digital distribution, challenging global streaming giants.",
    category: "tech",
    image: techStartup,
    readTime: "4 min read",
    date: "Jan 23, 2026",
    contentType: "article",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "7",
    title: "Ghanaian Cuisine Gains Global Recognition",
    excerpt: "Chefs worldwide incorporate traditional Ghanaian flavors into menus, bringing international attention to West Africa's culinary heritage.",
    category: "culture",
    image: ghanaianFood,
    readTime: "6 min read",
    date: "Jan 22, 2026",
    contentType: "article",
    status: "published",
    featured: false,
    author: "Admin",
    source: "static",
  },
  {
    id: "8",
    title: "AI Revolutionizes African Entertainment Industry",
    excerpt: "From music production to visual effects, artificial intelligence transforms how African creators produce and distribute content.",
    category: "tech",
    image: techStartup,
    readTime: "7 min read",
    date: "Jan 22, 2026",
    contentType: "feature",
    status: "published",
    featured: true,
    author: "Admin",
    source: "static",
  },
];

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
