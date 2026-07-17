import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api-base';
import { MapPin } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
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

export default function LocalNewsRail({ excludeIds = [] }: LocalNewsRailProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLabel, setLocationLabel] = useState('Local News');

  useEffect(() => {
    const fetchLocalNews = async () => {
      let lat: number | null = null;
      let lng: number | null = null;

      try {
        if (Capacitor.isNativePlatform()) {
          const permission = await Geolocation.checkPermissions();
          if (permission.coarseLocation !== 'granted' && permission.location !== 'granted') {
            await Geolocation.requestPermissions();
          }

          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 5000
          });
          
          if (pos && pos.coords) {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          }
        }
      } catch (err) {
        console.warn('Geolocation sensor failed or permission denied, using IP fallback:', err);
      }

      let url = apiUrl('/api/news/local');
      if (lat !== null && lng !== null) {
        url += `?lat=${lat}&lng=${lng}`;
      }

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const filtered = data.filter(a => !excludeIds.includes(a.id) && a.image).slice(0, 8);
            setArticles(filtered);
            if (filtered.length > 0) {
              const cat = filtered[0].category?.toLowerCase() || '';
              if (cat.includes('nigeria') || cat.includes('nigerian')) {
                setLocationLabel('Lagos & Nigeria');
              } else if (cat.includes('ghana')) {
                setLocationLabel('Accra & Ghana');
              } else if (cat.includes('kenya')) {
                setLocationLabel('Nairobi & Kenya');
              } else if (cat.includes('south-africa')) {
                setLocationLabel('Johannesburg & SA');
              } else if (cat.includes('uk')) {
                setLocationLabel('London & UK');
              } else if (cat.includes('usa')) {
                setLocationLabel('Washington & USA');
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load local news:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLocalNews();
  }, [excludeIds]);

  if (loading || articles.length === 0) return null;

  return (
    <section 
      className="w-full py-4 mt-1 border-t-[0.5px] border-b-[0.5px] border-[#362F3D]" 
      style={{ backgroundColor: '#211D26' }}
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
