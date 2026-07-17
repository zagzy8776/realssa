import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api-base';
import NewsCard from './NewsCard';

interface BreakingArticle {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  date: string;
  externalLink?: string;
  source_name?: string;
}

interface BreakingNowRailProps {
  excludeIds?: string[];
}

export default function BreakingNowRail({ excludeIds = [] }: BreakingNowRailProps) {
  const [articles, setArticles] = useState<BreakingArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/news/breaking?diverse=true'))
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          const filtered = data.filter(a => !excludeIds.includes(a.id));
          setArticles(filtered.slice(0, 5));
        } else {
          setArticles([]);
        }
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [excludeIds]);

  if (loading || articles.length === 0) return null;

  return (
    <section 
      className="w-full py-4 border-t-[0.5px] border-b-[0.5px] border-[#362F3D]"
      style={{ backgroundColor: '#211D26' }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em]"
            style={{ 
              fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace", 
              color: '#4FBFA8' 
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#4FBFA8] animate-pulse"></span>
            BREAKING NOW
          </div>
          <p 
            className="text-[#8C8494] text-[11px] font-mono uppercase tracking-[0.03em] hidden sm:block"
            style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
          >
            · UPDATED EVERY 30 MINUTES — {articles.length} FRESH STORIES
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
                author={article.source_name}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
