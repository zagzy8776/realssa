import { apiUrl } from '@/lib/api-base';
import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import { SearchBar } from "@/components/SearchBar";
import Footer from "@/components/Footer";
import LazyAd from "@/components/LazyAd";
import NewsCard from "@/components/NewsCard";
import NewsTicker from "@/components/NewsTicker";
import SEO from "@/components/SEO";
import { useEffect, useState } from "react";
import ReadProgressBar from "@/components/ReadProgressBar";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonGrid } from "@/components/SkeletonCard";
import MostRead from "@/components/MostRead";
import BreakingNowRail from "@/components/BreakingNowRail";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import LoadingOverlay from "@/components/LoadingOverlay";
import TrendingHashtags from "@/components/TrendingHashtags";
import StoryGroupCard from "@/components/StoryGroupCard";
import LocalNewsRail from "@/components/LocalNewsRail";
import { AtAGlanceCarousel } from "@/components/AtAGlanceCarousel";
import { useNavigate } from "react-router-dom";

let initialLoadDone = false;

const Index = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [stories, setStories] = useState([]);
  const [allArticles, setAllArticles] = useState([]);
  const [trendingArticles, setTrendingArticles] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(!initialLoadDone);
  const [error, setError] = useState(null);

  const LIVE_VIDEOS = [
    { id: 'v1', title: 'Channels TV Live', embedUrl: 'https://www.youtube.com/embed/W8nThq62Vb4?mute=1' },
    { id: 'v2', title: 'Arise News Live', embedUrl: 'https://www.youtube.com/embed/x4wL-fWyhI0?mute=1' },
    { id: 'v3', title: 'TVC News Live', embedUrl: 'https://www.youtube.com/embed/Mv14aabg4mA?mute=1' }
  ];

  useEffect(() => {
    fetchStories();
    
    // Register app-close telemetry sync hooks to ensure light user profiles get saved
    const handleCloseSync = () => {
      try {
        const deviceId = localStorage.getItem('realssa_device_uuid');
        const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
        if (deviceId && prefs.counts) {
          navigator.sendBeacon(
            apiUrl('/api/profile/sync'),
            JSON.stringify({ deviceId, counts: prefs.counts })
          );
        }
      } catch (err) {}
    };

    window.addEventListener('beforeunload', handleCloseSync);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleCloseSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Register Capacitor Native App state change listener for resilient mobile backgrounding
    let nativeAppListener: any = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            try {
              const deviceId = localStorage.getItem('realssa_device_uuid');
              const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
              if (deviceId && prefs.counts) {
                fetch(apiUrl('/api/profile/sync'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deviceId, counts: prefs.counts }),
                  keepalive: true
                }).catch(() => {});
              }
            } catch (err) {}
          }
        });
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('beforeunload', handleCloseSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (nativeAppListener) {
        nativeAppListener.remove();
      }
    };
  }, []);
 
  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate or retrieve persistent device UUID
      let deviceId = '';
      try {
        let savedId = localStorage.getItem('realssa_device_uuid');
        if (!savedId) {
          savedId = crypto.randomUUID ? crypto.randomUUID() : 'dev-' + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('realssa_device_uuid', savedId);
        }
        deviceId = savedId;
      } catch (uuidErr) {}

      const ts = Date.now();
      const deviceParam = deviceId ? `&deviceId=${deviceId}` : '';
      const [featuredRes, articlesRes, worldRes, ukRes, trendingRes, groupsRes] = await Promise.allSettled([
        fetch(apiUrl(`/api/articles/featured?t=${ts}`)),
        fetch(apiUrl(`/api/articles?t=${ts}${deviceParam}`)),
        fetch(apiUrl(`/api/news/world?t=${ts}`)),
        fetch(apiUrl(`/api/news/uk?t=${ts}`)),
        fetch(apiUrl(`/api/articles/trending?category=nigerian-news&diverse=true&t=${ts}${deviceParam}`)),
        fetch(apiUrl(`/api/stories/grouped?t=${ts}`))
      ]);

      const isNotPunch = (item: any) => {
        const sourceName = (item.source_name || item.source || '').toLowerCase();
        const url = (item.url || '').toLowerCase();
        return !sourceName.includes('punch') && !url.includes('punchng.com');
      };

      let loadedStories = [];
      if (featuredRes.status === 'fulfilled' && featuredRes.value.ok) {
        loadedStories = (await featuredRes.value.json()).filter(isNotPunch);
        setStories(loadedStories);
      }

      let loadedTrending = [];
      if (trendingRes.status === 'fulfilled' && trendingRes.value.ok) {
        loadedTrending = (await trendingRes.value.json()).filter(isNotPunch);
        setTrendingArticles(loadedTrending.slice(0, 5));
      }

      if (groupsRes.status === 'fulfilled' && groupsRes.value.ok) {
        const groups = await groupsRes.value.json();
        const filteredGroups = groups
          .map((g: any) => ({ ...g, sources: (g.sources || []).filter(isNotPunch) }))
          .filter((g: any) => (g.sources || []).length > 0);
        setStoryGroups(filteredGroups);
      }

      let allNews = [];
      if (articlesRes.status === 'fulfilled' && articlesRes.value.ok)
        allNews = [...allNews, ...await articlesRes.value.json()];
      if (worldRes.status === 'fulfilled' && worldRes.value.ok)
        allNews = [...allNews, ...(await worldRes.value.json()).slice(0, 15)];
      if (ukRes.status === 'fulfilled' && ukRes.value.ok)
        allNews = [...allNews, ...(await ukRes.value.json()).slice(0, 15)];
        
      allNews = allNews.filter(isNotPunch);

      // Exclude articles already shown in Featured and Trending sections
      const usedIds = new Set([
        ...loadedStories.map(s => s.id),
        ...loadedTrending.map(t => t.id)
      ]);

      allNews.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
      const uniqueNews = allNews.filter((v, i, a) => 
        !usedIds.has(v.id) && a.findIndex(t => t.title === v.title) === i
      );


      try {
        const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
        if (prefs.topCategory) {
          uniqueNews.sort((a, b) => {
            if (a.category === prefs.topCategory && b.category !== prefs.topCategory) return -1;
            if (b.category === prefs.topCategory && a.category !== prefs.topCategory) return 1;
            return 0;
          });
        }
      } catch (e) {}

      setAllArticles(uniqueNews);

      // Save visible article IDs to sessionStorage so Reels feed can exclude them
      try {
        const visibleIds = [
          ...loadedStories.map(s => s.id),
          ...loadedTrending.slice(0, 5).map(t => t.id),
          ...uniqueNews.map(n => n.id)
        ].filter(Boolean);
        const uniqueIds = Array.from(new Set(visibleIds));
        sessionStorage.setItem('home_page_article_ids', JSON.stringify(uniqueIds));
      } catch (cacheErr) {
        console.error('Error saving home page article ids:', cacheErr);
      }

      // If connected to WiFi, fetch and sync the Daily Digest package for offline mode
      try {
        const { Network } = await import('@capacitor/network');
        const netStatus = await Network.getStatus();
        if (netStatus.connected && netStatus.connectionType === 'wifi') {
          fetch(apiUrl('/api/digest/daily'))
            .then(res => res.ok ? res.json() : null)
            .then(digestData => {
              if (digestData) {
                localStorage.setItem('realssa_offline_digest', JSON.stringify({
                  timestamp: Date.now(),
                  articles: digestData
                }));
              }
            })
            .catch(() => {});
        }
      } catch (netErr) {}

      // Hide initial loading state after first successful fetch
      if (initialLoading) {
        setInitialLoading(false);
        initialLoadDone = true;
      }
    } catch (err) {
      // Offline fallback trigger: attempt to load from cached offline Daily Digest
      let loadedFromCache = false;
      try {
        const offlineData = localStorage.getItem('realssa_offline_digest');
        if (offlineData) {
          const { articles: cachedArticles, timestamp } = JSON.parse(offlineData);
          if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
            setAllArticles(cachedArticles);
            setStories(cachedArticles.slice(0, 2));
            setTrendingArticles(cachedArticles.slice(2, 7));
            loadedFromCache = true;
            
            const ageHours = Math.floor((Date.now() - timestamp) / 3600000);
            setError(`Offline Mode. Showing Daily Digest cached ${ageHours} hour(s) ago.`);
          }
        }
      } catch (cacheLoadErr) {
        console.error('Failed to load daily digest cache:', cacheLoadErr);
      }

      if (!loadedFromCache) {
        setError('Stories temporarily unavailable. Please check your internet connection.');
      }

      if (initialLoading) {
        setInitialLoading(false);
        initialLoadDone = true;
      }
    } finally {
      setLoading(false);
    }
  };

  usePullToRefresh({ onRefresh: fetchStories, threshold: 100, disabled: loading });

  const getImage = (item) => {
    if (!item.image) return null;
    return item.image.startsWith('//') ? 'https:' + item.image : item.image;
  };

  const getFilteredArticles = () => {
    if (activeFilter === 'deep_dives') {
      return allArticles.filter((art: any) => (art.summary || art.excerpt || '').length > 150);
    }
    if (activeFilter === 'facts') {
      return allArticles.filter((art: any) => ['general', 'news', 'sports', 'politics', 'business'].includes(art.category || ''));
    }
    if (activeFilter === 'local') {
      return allArticles.filter((art: any) => art.category === 'local');
    }
    return allArticles;
  };

  const filteredArticles = getFilteredArticles();
  const visibleArticles = filteredArticles.slice(0, visibleCount);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 && !loading && visibleCount < allArticles.length)
        setVisibleCount(prev => prev + 12);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, visibleCount, allArticles.length]);

  return (
    <div className="min-h-screen bg-background">
      {initialLoading && <LoadingOverlay />}
      <SEO
        title="RealSSA | Breaking News, Politics, Tech & Culture in Africa"
        description="RealSSA is your premier news hub for Nigeria and Africa. Get live updates on politics, entertainment, tech startups, sports, and business."
        keywords="RealSSA, Latest political news in Nigeria today, Afrobeats latest releases, Nigerian startup funding news, breaking news Africa, best news site in Nigeria, Lagos business updates, Nigerian economy breaking news, Nollywood gossip and news, African entertainment updates, Crypto regulations in Africa, Tech news Africa, Nigeria 2027 elections, African football news, Premier league updates Africa, local sports highlights, Nigeria tech ecosystem, Bitcoin Africa, Web3 Nigeria, trending news in Lagos, Abuja political news, African business trends, Nigerian music industry, Afrobeats global, Nigerian fashion trends, West African news, breaking news South Africa, breaking news Kenya, breaking news Ghana, top African news aggregator, daily news Nigeria, reliable news Africa"
      />
      {error && !loading && (
        <div className="bg-red-600/90 text-white text-center text-sm py-2 px-4">
          ⚠️ {error} — Pull down to refresh.
        </div>
      )}
      <ReadProgressBar />
      <Header />
      <NewsTicker />
      <AtAGlanceCarousel activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <BreakingNowRail excludeIds={stories.map((s: any) => s.id)} />
      <LocalNewsRail excludeIds={stories.map((s: any) => s.id)} />
      <SocialButtons />

      <main>
        <HeroSection stories={stories} />
        <SearchBar />
        {/* Trending Hashtags — powered by real-time keyword extraction */}
        <div className="container mx-auto px-4 -mt-4 mb-2">
          <TrendingHashtags />
        </div>

        {/* Full Coverage / Story Groups */}
        {!loading && storyGroups.length > 0 && (
          <section className="container mx-auto px-4 py-6 bg-muted/20 my-6 rounded-3xl">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
              <span className="text-blue-500">📡</span> Full Coverage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {storyGroups.slice(0, 3).map((group: any, idx) => (
                <StoryGroupCard key={idx} group={group} />
              ))}
            </div>
          </section>
        )}

        {/* Trending in Nigeria */}
        {!loading && trendingArticles.length > 0 && (
          <section className="container mx-auto px-4 py-6">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 border-b border-border pb-2">
              Trending in Nigeria 🇳🇬
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {trendingArticles.map((article: any) => (
                <NewsCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  excerpt=""
                  category={article.category || 'news'}
                  image={getImage(article)}
                  readTime={article.readTime || '3 min read'}
                  date={article.date || new Date().toLocaleDateString()}
                  externalLink={article.externalLink}
                  storyHash={article.story_hash || article.storyHash}
                  localVerifiedCount={article.local_verified_count || article.localVerifiedCount}
                  rumorFlagCount={article.rumor_flag_count || article.rumorFlagCount}
                />
              ))}
            </div>
          </section>
        )}

        {/* Live TV Strip — desktop only, sits above Discover Feed */}
        <section className="container mx-auto px-4 py-4 hidden md:block">
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">🔴 LIVE TV</span>
            <span className="text-muted-foreground font-normal text-sm">Watch live news channels</span>
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {LIVE_VIDEOS.map((video) => (
              <div key={video.id} className="flex-shrink-0 w-64 bg-card rounded-xl border border-border overflow-hidden shadow-md snap-start">
                <iframe
                  className="w-full aspect-video"
                  src={video.embedUrl}
                  title={video.title}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <p className="text-xs font-semibold text-center text-muted-foreground py-2 px-3">{video.title}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Discover Feed + Most Read sidebar */}
        <section className="container mx-auto px-4 py-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 border-b border-border pb-4">
            Your <span className="text-gradient-gold">Discover Feed</span>
          </h2>
          <div className="flex flex-col lg:flex-row gap-8">

            {/* Main feed */}
            <div className="flex-1 min-w-0">
              {loading && visibleCount <= 12 ? (
                <SkeletonGrid count={6} columns={3} />
              ) : visibleArticles.length > 0 ? (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {visibleArticles.map((article: any) => (
                      <div key={article.id}>
                        <NewsCard
                          id={article.id}
                          title={article.title}
                          excerpt={article.excerpt || ''}
                          category={article.category || 'general'}
                          image={getImage(article)}
                          readTime={article.readTime || '3 min read'}
                          date={article.date || new Date().toLocaleDateString()}
                          externalLink={article.externalLink}
                          storyHash={article.story_hash || article.storyHash}
                          localVerifiedCount={article.local_verified_count || article.localVerifiedCount}
                          rumorFlagCount={article.rumor_flag_count || article.rumorFlagCount}
                        />
                      </div>
                    ))}
                  </div>
                  {visibleCount < allArticles.length && (
                    <div className="py-8 text-center">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" role="status" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-4xl mb-3">📰</p>
                  {error ? (
                    <p className="text-red-500 font-semibold">{error}</p>
                  ) : (
                    <p>No articles yet. Check back soon!</p>
                  )}
                </div>
              )}
            </div>

            {/* Most Read sidebar — sticky on desktop */}
            <aside className="w-full lg:w-80 shrink-0">
              <div className="sticky top-24">
                <MostRead />
              </div>
            </aside>
          </div>
        </section>

        <section className="py-4 md:py-8">
          <div className="container mx-auto px-4"><LazyAd /></div>
        </section>
      </main>

      {/* Floating Live Wire button */}
      <button
        onClick={() => navigate('/wire')}
        title="Live Broadcast Wire"
        style={{
          position: 'fixed', bottom: 88, right: 20, zIndex: 999,
          height: 42, borderRadius: 21,
          background: '#000',
          border: '1px solid #2a2535',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(245,158,11,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)'; }}
      >
        <span className="text-amber-500 font-extrabold text-sm">📢</span>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Live Wire</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 2s infinite', flexShrink: 0 }} />
      </button>

      <Footer />
    </div>
  );
};

export default Index;
