import { useState, useEffect } from 'react';
import { MapPin, ChevronRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface NewsItem {
  id: string | number;
  title: string;
  category?: string;
  source_name?: string;
  image?: string;
  read_time?: string;
}

export default function TrendingNearYouRail() {
  const [city, setCity] = useState('Lagos');
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Detect city or default to Lagos
    const savedCity = localStorage.getItem('realssa_user_city') || 'Lagos';
    setCity(savedCity);

    // Fetch top news for detected region
    axios
      .get(`/api/rss/articles?limit=6`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setArticles(res.data);
        } else if (res.data && Array.isArray(res.data.articles)) {
          setArticles(res.data.articles);
        }
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || articles.length === 0) return null;

  return (
    <section className="w-full my-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              Trending in {city} <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </h3>
            <p className="text-[11px] text-muted-foreground">Most read local updates near you</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/trending')}
          className="text-xs font-semibold text-primary flex items-center gap-0.5 hover:underline"
        >
          View All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Horizontal Scroll Rail */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {articles.map((item, idx) => (
          <div
            key={item.id || idx}
            onClick={() => navigate(`/article/${item.id}`)}
            className="w-[260px] shrink-0 snap-start bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary/50 transition-all cursor-pointer space-y-2 group"
          >
            {item.image && (
              <div className="w-full h-32 rounded-lg overflow-hidden bg-muted relative">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm">
                  {item.category || 'Local'}
                </span>
              </div>
            )}

            <h4 className="text-xs font-bold line-clamp-2 text-card-foreground group-hover:text-primary transition-colors leading-snug">
              {item.title}
            </h4>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
              <span>{item.source_name || 'RealSSA Wire'}</span>
              <span>{item.read_time || '2-Min Read'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
