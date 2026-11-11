import { useState, useEffect, useMemo } from 'react';
import { apiUrl } from '@/lib/api-base';
import { MapPin } from 'lucide-react';
import NewsCard from './NewsCard';

interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  date: string;
  author: string;
  externalLink?: string;
}

interface LocalNewsRailProps {
  excludeIds?: string[];
}

// Lightweight, privacy-safe country detection. No geolocation prompt is shown.
const COUNTRY_BY_REGION: Record<string, string> = {
  NG: 'nigeria', GH: 'ghana', KE: 'kenya', ZA: 'south-africa', GB: 'uk', US: 'usa',
  CA: 'canada', AU: 'australia', IN: 'india', NL: 'netherlands', DE: 'germany',
  FR: 'france', ES: 'spain', IT: 'italy', BE: 'belgium', IE: 'ireland',
  SE: 'sweden', CH: 'switzerland', PT: 'portugal', PL: 'poland', AT: 'austria',
  DK: 'denmark', NO: 'norway', FI: 'finland'
};

const COUNTRY_BY_TIMEZONE: Record<string, string> = {
  'Europe/Amsterdam': 'netherlands', 'Europe/Berlin': 'germany', 'Europe/Paris': 'france',
  'Europe/Madrid': 'spain', 'Europe/Rome': 'italy', 'Europe/Brussels': 'belgium',
  'Europe/Dublin': 'ireland', 'Europe/Stockholm': 'sweden', 'Europe/Zurich': 'switzerland',
  'Europe/Lisbon': 'portugal', 'Europe/Warsaw': 'poland', 'Europe/Vienna': 'austria',
  'Europe/Copenhagen': 'denmark', 'Europe/Oslo': 'norway', 'Europe/Helsinki': 'finland',
  'Africa/Lagos': 'nigeria', 'Africa/Accra': 'ghana', 'Africa/Nairobi': 'kenya',
  'Africa/Johannesburg': 'south-africa', 'Europe/London': 'uk',
  'America/New_York': 'usa', 'America/Toronto': 'canada',
  'Australia/Sydney': 'australia', 'Asia/Kolkata': 'india'
};

function detectCountry(): string {
  try {
    const saved = localStorage.getItem('realssa_country');
    if (saved) {
      const code = saved.trim().toUpperCase();
      if (COUNTRY_BY_REGION[code]) return COUNTRY_BY_REGION[code];
      const slug = saved.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (slug) return slug;
    }
  } catch { }

  try {
    const region = (navigator.language || '').split('-')[1]?.toUpperCase();
    if (region && COUNTRY_BY_REGION[region]) return COUNTRY_BY_REGION[region];
  } catch { }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone && COUNTRY_BY_TIMEZONE[timezone]) return COUNTRY_BY_TIMEZONE[timezone];
  } catch { }

  return 'nigeria';
}

export default function LocalNewsRail({ excludeIds = [] }: LocalNewsRailProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLabel, setLocationLabel] = useState('Local News');
  const excludeKey = useMemo(() => excludeIds.join(','), [excludeIds]);

  useEffect(() => {
    let cancelled = false;

    const fetchLocalNews = async () => {
      const country = detectCountry();
      try { localStorage.setItem('realssa_country', country); } catch { }

      try {
        const res = await fetch(apiUrl(`/api/country-feed?slug=${encodeURIComponent(country)}&limit=12`));
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.articles) ? data.articles : []);
        const excluded = new Set(excludeKey ? excludeKey.split(',') : []);
        const filtered = list
          .filter((article: NewsArticle) => !excluded.has(article.id) && article.image)
          .slice(0, 8);
        if (cancelled) return;
        setArticles(filtered);
        if (filtered.length > 0) {
          setLocationLabel(data.location || country.replace(/-/g, ' '));
        }
      } catch (err) {
        console.error('Failed to load local news:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLocalNews();
    return () => { cancelled = true; };
  }, [excludeKey]);

  if (loading || articles.length === 0) return null;

  return (
    <section 
      className="w-full py-4 mt-1 border-t-[0.5px] border-b-[0.5px] border-border bg-card/50 dark:bg-[#211D26]" 
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em]"
            style={{ 
              fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace", 
              color: '#E8874A' 
            }}
          >
            <MapPin className="h-4 w-4 animate-bounce text-[#E8874A]" />
            NEAR YOU: {locationLabel}
          </div>
          <p 
            className="text-[#8C8494] text-[11px] font-mono uppercase tracking-[0.03em] hidden sm:block"
            style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
          >
            · HYPER-LOCAL STORIES SORTED DYNAMICALLY
          </p>
        </div>

        {/* Horizontal scroll rail */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          {articles.map((article) => (
            <div
              key={article.id}
              className="flex-none w-56 sm:w-64 snap-start"
            >
              <NewsCard
                id={article.id}
                title={article.title}
                excerpt=""
                category={article.category as any || 'general'}
                image={article.image}
                readTime="3 min read"
                date={article.date}
                externalLink={article.externalLink}
                showBookmark={false}
                author={article.author}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
