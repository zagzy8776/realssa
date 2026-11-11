import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiUrl } from '@/lib/api-base';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import ReelsCard from './ReelsCard';
import BrandLoader from './BrandLoader';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual } from 'swiper/modules';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import 'swiper/css';
import 'swiper/css/virtual';

interface ReelsCategoryColumnProps {
  fetchUrl: string;
  isActive: boolean;
  categoryName: string;
}

export default function ReelsCategoryColumn({ fetchUrl, isActive, categoryName }: ReelsCategoryColumnProps) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeVerticalIndex, setActiveVerticalIndex] = useState(0);
  const cardStartRef = useRef<number>(Date.now());

  const sendCardDwell = (article: any, seconds: number) => {
    if (!article || seconds < 2) return;
    const deviceId = localStorage.getItem('realssa_device_uuid') || '';
    if (!deviceId) return;
    const category = article.category || 'news';
    const payload = JSON.stringify({ deviceId, category, seconds, articleId: article.id });
    const url = apiUrl('/api/users/dwell');
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  };

  const fetchPage = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(false);
    try {
      const sep = fetchUrl.includes('?') ? '&' : '?';
      const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
      const preferred = prefs.topCategory ? `&preferred=${encodeURIComponent(prefs.topCategory)}` : '';
      
      let excludeQuery = '';
      try {
        const cachedIds = sessionStorage.getItem('home_page_article_ids');
        if (cachedIds) {
          const ids = JSON.parse(cachedIds);
          if (ids.length > 0) {
            excludeQuery = `&exclude=${encodeURIComponent(ids.join(','))}`;
          }
        }
      } catch (e) {}

      const url = `${fetchUrl}${sep}page=${pageNum}&limit=15&cb=${Date.now()}${preferred}${excludeQuery}`;
      
      const res = await fetchWithRetry(url, 1);
      if (!res) throw new Error('Fetch failed after retries');
      
      const json = await res.json();
      let data: any[] = [];
      if (Array.isArray(json)) data = json;
      else if (Array.isArray(json?.data)) data = json.data;
      else if (Array.isArray(json?.articles)) data = json.articles;

      if (data.length < 15) setHasMore(false);

      const seen = new Set<string>();
      const unique = data.filter((item) => {
        const key = item.id ?? item.title ?? Math.random().toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setArticles(prev => {
        if (!append) return unique;
        const allIds = new Set(prev.map(a => a.id ?? a.title));
        return [...prev, ...unique.filter(u => !allIds.has(u.id ?? u.title))];
      });
    } catch (err: any) {
      console.error('[Reels] fetch error:', err.message);
      if (!append) setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    setArticles([]);
    setPage(1);
    setHasMore(true);
    setActiveVerticalIndex(0);
    fetchPage(1, false);
  }, [fetchUrl]);

  const handleReachEnd = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPage(nextPage, true);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black">
        <BrandLoader size="inline" />
      </div>
    );
  }

  /* ── Error ── */
  if (error || articles.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black text-white/50 space-y-3">
        <p className="text-xl font-bold">{error ? '⚡ Connection issue' : `No stories in ${categoryName}`}</p>
        <p className="text-sm">{error ? 'Pull down to retry.' : 'Check back later for updates.'}</p>
      </div>
    );
  }

  /* ── Articles ── */
  return (
    <Swiper
      modules={[Virtual]}
      virtual
      direction="vertical"
      nested={true}
      slidesPerView={1}
      noSwipingClass="swiper-no-swiping"
      className="h-full w-full bg-black"
      style={{ height: '100%' }}
      onReachEnd={handleReachEnd}
      onSlideChange={(swiper) => {
        // Capture dwell time for the card being left
        const seconds = Math.round((Date.now() - cardStartRef.current) / 1000);
        sendCardDwell(articles[activeVerticalIndex], seconds);
        cardStartRef.current = Date.now();

        setActiveVerticalIndex(swiper.activeIndex);
        if (Capacitor.isNativePlatform()) {
          Haptics.impact({ style: ImpactStyle.Light });
        }
      }}
      threshold={10}
      speed={350}
      shortSwipes={true}
      resistanceRatio={0.85}
      touchStartPreventDefault={false}
    >
      {articles.map((article, index) => (
        <SwiperSlide
          key={article.id ?? `slide-${index}`}
          virtualIndex={index}
          style={{ height: '100%' }}
        >
          <div style={{ height: '100%', width: '100%' }}>
            <ReelsCard article={article} isActive={isActive && index === activeVerticalIndex} />
          </div>
        </SwiperSlide>
      ))}
      {loadingMore && (
        <SwiperSlide virtualIndex={articles.length} style={{ height: '100%' }}>
          <div className="h-full w-full flex items-center justify-center bg-black">
            <BrandLoader size="inline" />
          </div>
        </SwiperSlide>
      )}
    </Swiper>
  );
}
