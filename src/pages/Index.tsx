import { apiUrl } from '@/lib/api-base';
import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

import LazyAd from "@/components/LazyAd";
import NewsCard from "@/components/NewsCard";
import NewsTicker from "@/components/NewsTicker";
import SEO from "@/components/SEO";
import { useEffect, useState, useRef } from "react";
import ReadProgressBar from "@/components/ReadProgressBar";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonGrid } from "@/components/SkeletonCard";
import MostRead from "@/components/MostRead";
import BreakingNowRail from "@/components/BreakingNowRail";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import LoadingOverlay from "@/components/LoadingOverlay";
import StoryGroupCard from "@/components/StoryGroupCard";
import LocalNewsRail from "@/components/LocalNewsRail";
import { Search } from "lucide-react";
import RealSSASearchModal from "@/components/RealSSASearchModal";
import { useNavigate } from "react-router-dom";

// HTML skeleton in index.html handles all first-load visuals.
// Never show the cinematic BrandLoader splash — skip it every session.
const SPLASH_SESSION_KEY = 'realssa_splash_shown';
let initialLoadDone = true; // Always true — HTML skeleton replaces this


const Index = () => {
  const navigate = useNavigate();
  const lastSyncTimeRef = useRef(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const [stories, setStories] = useState([]);
  const [allArticles, setAllArticles] = useState([]);
  const [trendingArticles, setTrendingArticles] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [breakingIds, setBreakingIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [loading, setLoading] = useState(true);
  const [initialLoading] = useState(false); // HTML skeleton handles first load — never show BrandLoader
  const [error, setError] = useState(null);

  const LIVE_VIDEOS = [
    { id: 'peller-jarvis-wedding', title: 'Peller & Jarvis Traditional Wedding', embedUrl: 'https://www.youtube.com/embed/MnG0Ldos2wU?mute=1' },
    { id: 'v1', title: 'Channels TV Live', embedUrl: 'https://www.youtube.com/embed/W8nThq62Vb4?mute=1' },
    { id: 'v2', title: 'Arise News Live', embedUrl: 'https://www.youtube.com/embed/x4wL-fWyhI0?mute=1' },
    { id: 'v3', title: 'TVC News Live', embedUrl: 'https://www.youtube.com/embed/Mv14aabg4mA?mute=1' }
  ];

  useEffect(() => {
    fetchStories();

    // Clean up stale localStorage entries (e.g. offline digest older than 48 hours)
    try {
      const offlineDigestStr = localStorage.getItem('realssa_offline_digest');
      if (offlineDigestStr) {
        const digest = JSON.parse(offlineDigestStr);
        if (digest.timestamp && Date.now() - digest.timestamp > 2 * 24 * 60 * 60 * 1000) { // 2 days
          localStorage.removeItem('realssa_offline_digest');
        }
      }
    } catch (e) { }

    // Register app-close telemetry sync hooks to ensure light user profiles get saved
    const handleCloseSync = () => {
      try {
        const now = Date.now();
        // Throttle telemetry sync to once every 5 minutes (300,000 ms) to save battery/data
        if (now - lastSyncTimeRef.current < 300000) return;

        const deviceId = localStorage.getItem('realssa_device_uuid');
        const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
        if (deviceId && prefs.counts) {
          navigator.sendBeacon(
            apiUrl('/api/profile/sync'),
            JSON.stringify({ deviceId, counts: prefs.counts })
          );
          lastSyncTimeRef.current = now;
        }
      } catch (err) { }
    };

    window.addEventListener('beforeunload', handleCloseSync);

    // Register Capacitor Native App state change listener for resilient mobile backgrounding
    let nativeAppListener: any = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            try {
              const now = Date.now();
              if (now - lastSyncTimeRef.current < 300000) return;

              const deviceId = localStorage.getItem('realssa_device_uuid');
              const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
              if (deviceId && prefs.counts) {
                fetch(apiUrl('/api/profile/sync'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deviceId, counts: prefs.counts }),
                  keepalive: true
                }).then(() => {
                  lastSyncTimeRef.current = now;
                }).catch(() => { });
              }
            } catch (err) { }
          }
        });
      }).catch(() => { });
    }

    return () => {
      window.removeEventListener('beforeunload', handleCloseSync);
      if (nativeAppListener) {
        nativeAppListener.remove();
      }
    };
  }, []);

  const fetchStories = async () => {
    try {
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
      } catch (uuidErr) { }

      const ts = Date.now();
      const deviceParam = deviceId ? `&deviceId=${deviceId}` : '';

      const isNotPunch = (item: any) => {
        const sourceName = (item.source_name || item.source || '').toLowerCase().trim();
        const url = (item.url || item.external_link || item.externalLink || '').toLowerCase();
        return sourceName !== 'punch' && sourceName !== 'the punch' && !url.includes('punchng.com');
      };

      // ── Stale-While-Revalidate: show cached articles INSTANTLY ──────────
      // If we have a recent cache (< 5 min), render it immediately so the
      // page feels instant, then fetch fresh data silently in the background.
      const CACHE_KEY = 'realssa_home_cache_v2';
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      let servedFromCache = false;
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && ts - cached.ts < CACHE_TTL && Array.isArray(cached.articles) && cached.articles.length > 0) {
          setAllArticles(cached.articles);
          if (Array.isArray(cached.stories)) setStories(cached.stories);
          setLoading(false);
          servedFromCache = true;
        }
      } catch (cacheReadErr) { }

      // ── Pre-warm the Vercel serverless function with a lightweight ping ──
      // Fire-and-forget — wakes up the cold function before the real fetch hits
      fetch(apiUrl('/api/articles?limit=1')).catch(() => {});

      // Stage 1: Load critical above-the-fold content immediately
      const [featuredRes, articlesRes, groupsRes] = await Promise.allSettled([
        fetch(apiUrl(`/api/articles/featured?t=${ts}`)),
        fetch(apiUrl(`/api/articles?t=${ts}${deviceParam}`)),
        fetch(apiUrl(`/api/stories/grouped?t=${ts}`))
      ]);

      let loadedStories = [];
      if (featuredRes.status === 'fulfilled' && featuredRes.value.ok) {
        loadedStories = (await featuredRes.value.json()).filter(isNotPunch);
        setStories(loadedStories);
      }

      if (groupsRes.status === 'fulfilled' && groupsRes.value.ok) {
        const groups = await groupsRes.value.json();
        const filteredGroups = groups
          .map((g: any) => ({ ...g, sources: (g.sources || []).filter(isNotPunch) }))
          .filter((g: any) => (g.sources || []).length > 0);
        setStoryGroups(filteredGroups);
      }

      let initialNews = [];
      if (articlesRes.status === 'fulfilled' && articlesRes.value.ok) {
        initialNews = await articlesRes.value.json();
      }

      const initialFiltered = (initialNews || []).filter(isNotPunch);

      // Reset error state on successful fetch
      setError(null);

      // Sort strictly by recency timestamp (newest articles ALWAYS on top)
      initialFiltered.sort((a: any, b: any) => {
        const timeA = new Date(a.date || a.created_at || a.published_at || 0).getTime();
        const timeB = new Date(b.date || b.created_at || b.published_at || 0).getTime();
        return timeB - timeA;
      });

      const initialUnique = initialFiltered.filter((v: any, i: number, a: any[]) =>
        a.findIndex(t => t.title === v.title) === i
      );

      // Set fresh timestamp-sorted articles
      setAllArticles(initialUnique);
      setLoading(false);

      // ── Save to cache for next visit ─────────────────────────────────────
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          ts: Date.now(),
          articles: initialUnique.slice(0, 40), // Cap at 40 items to keep localStorage lean
          stories: loadedStories.slice(0, 5),
        }));
      } catch (cacheWriteErr) { }

      // Stage 2: Lazy load secondary below-the-fold content in background after a 4-second delay to optimize initial paint
      setTimeout(() => {
        Promise.allSettled([
          fetch(apiUrl(`/api/news/world?t=${ts}`)),
          fetch(apiUrl(`/api/news/uk?t=${ts}`)),
          fetch(apiUrl(`/api/articles/trending?category=nigerian-news&diverse=true&t=${ts}${deviceParam}`))
        ]).then(async ([worldRes, ukRes, trendingRes]) => {
          let loadedTrending = [];
          if (trendingRes.status === 'fulfilled' && trendingRes.value.ok) {
            loadedTrending = (await trendingRes.value.json()).filter(isNotPunch);
            setTrendingArticles(loadedTrending.slice(0, 5));
          }

          let extraNews = [];
          if (worldRes.status === 'fulfilled' && worldRes.value.ok) {
            extraNews = [...extraNews, ...(await worldRes.value.json()).slice(0, 15)];
          }
          if (ukRes.status === 'fulfilled' && ukRes.value.ok) {
            extraNews = [...extraNews, ...(await ukRes.value.json()).slice(0, 15)];
          }

          extraNews = extraNews.filter(isNotPunch);

          // Merge initial news and lazy loaded news
          let combinedNews = [...initialNews, ...extraNews].filter(isNotPunch);
          const usedIds = new Set([
            ...loadedStories.map(s => s.id),
            ...loadedTrending.map(t => t.id)
          ]);

          combinedNews.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
          const finalUnique = combinedNews.filter((v, i, a) =>
            !usedIds.has(v.id) && a.findIndex(t => t.title === v.title) === i
          );

          // Re-apply preferences sorting
          try {
            const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
            if (prefs.topCategory) {
              finalUnique.sort((a, b) => {
                if (a.category === prefs.topCategory && b.category !== prefs.topCategory) return -1;
                if (b.category === prefs.topCategory && a.category !== prefs.topCategory) return 1;
                return 0;
              });
            }
          } catch (e) { }

          setAllArticles(finalUnique);

          // Save visible article IDs to sessionStorage so Reels feed can exclude them
          try {
            const visibleIds = [
              ...loadedStories.map(s => s.id),
              ...loadedTrending.slice(0, 5).map(t => t.id),
              ...finalUnique.map(n => n.id)
            ].filter(Boolean);
            const uniqueIds = Array.from(new Set(visibleIds));
            sessionStorage.setItem('home_page_article_ids', JSON.stringify(uniqueIds));
          } catch (cacheErr) { }

        }).catch((lazyErr) => console.error('Lazy loading failed:', lazyErr));
      }, 4000);

      // Offline digest caching (WiFi only)
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
            }).catch(() => { });
        }
      } catch (e) { }

      // Hide initial loading state after first successful fetch
      if (initialLoading) {
        setInitialLoading(false);
        initialLoadDone = true;
        try { sessionStorage.setItem(SPLASH_SESSION_KEY, '1'); } catch { }
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

  // Infinite scroll via IntersectionObserver sentinel — avoids reading
  // document.body.offsetHeight on every scroll frame (which forces layout
  // reflow and stutters on low-end phones).
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (loading || visibleCount >= allArticles.length) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => prev + 12);
        }
      },
      { rootMargin: '800px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, visibleCount, allArticles.length]);


  return (
    <div className="nr-page min-h-screen">
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

      {/* News ticker sits right below header */}
      <NewsTicker />

      {/* Breaking rail still runs but doesn't eat layout above the fold */}
      <div className="hidden">
        <BreakingNowRail excludeIds={stories.map((s: any) => s.id)} onLoaded={(ids) => setBreakingIds(ids)} />
        <LocalNewsRail excludeIds={[...stories.map((s: any) => s.id), ...breakingIds]} />
      </div>
      <SocialButtons />

      <main style={{ paddingTop: "0.5rem" }}>

        {/* ══ HERO — Full-bleed editorial breaking story ══ */}
        <HeroSection />

        {/* ══ CATEGORY PILL BAR ══ */}
        <div
          className="sticky z-40 px-3 sm:px-4 py-2.5"
          style={{
            top: "56px",
            background: "rgba(10,10,15,0.92)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-hide max-w-screen-xl mx-auto">
            {[
              { key: "all", label: "All" },
              { key: "facts", label: "Nigeria" },
              { key: "deep_dives", label: "In-Depth" },
              { key: "local", label: "Local" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`nr-pill flex-shrink-0 ${activeFilter === key ? "nr-pill-active" : "nr-pill-inactive"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* RealSSA Search Modal for AI quick searching */}
        <RealSSASearchModal
          isOpen={isAiSearchOpen}
          onClose={() => setIsAiSearchOpen(false)}
        />

        {/* ══ EDITORIAL 2-COLUMN GRID (Full Coverage + Trending) ══ */}
        {!loading && (storyGroups.length > 0 || trendingArticles.length > 0) && (
          <section className="px-3 sm:px-4 py-5 max-w-screen-xl mx-auto">
            <h2 className="nr-section-title mb-4">Top Stories</h2>

            {/* Desktop: left=big card, right=2 stacked | Mobile: stack all */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

              {/* Big featured card — first trending article */}
              {trendingArticles[0] && (
                <div className="lg:col-span-3">
                  <NewsCard
                    id={trendingArticles[0].id}
                    title={trendingArticles[0].title}
                    excerpt={trendingArticles[0].excerpt || trendingArticles[0].ai_summary || ""}
                    category={trendingArticles[0].category || "news"}
                    image={getImage(trendingArticles[0])}
                    readTime={trendingArticles[0].read_time || "3 min read"}
                    date={trendingArticles[0].published_at ? new Date(trendingArticles[0].published_at).toLocaleDateString() : ""}
                    externalLink={trendingArticles[0].external_link}
                    storyHash={trendingArticles[0].story_hash}
                  />
                </div>
              )}

              {/* Right column — 2 stacked smaller cards */}
              <div className="lg:col-span-2 flex flex-col gap-3">
                {trendingArticles.slice(1, 3).map((article: any) => (
                  <NewsCard
                    key={article.id}
                    id={article.id}
                    title={article.title}
                    excerpt=""
                    category={article.category || "news"}
                    image={getImage(article)}
                    readTime={article.read_time || "3 min read"}
                    date={article.published_at ? new Date(article.published_at).toLocaleDateString() : ""}
                    externalLink={article.external_link}
                    storyHash={article.story_hash}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══ STORY GROUPS (Full Coverage) ══ */}
        {!loading && storyGroups.length > 0 && (
          <section className="px-3 sm:px-4 pb-5 max-w-screen-xl mx-auto">
            <h2 className="nr-section-title mb-4">Full Coverage</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {storyGroups.slice(0, 3).map((group: any, idx) => (
                <StoryGroupCard key={idx} group={group} />
              ))}
            </div>
          </section>
        )}

        {/* ══ LIVE TV STRIP — desktop only ══ */}
        <section className="px-3 sm:px-4 py-4 hidden md:block max-w-screen-xl mx-auto">
          <h2 className="nr-section-title mb-3">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded animate-pulse"
              style={{ background: "#EF4444", color: "#fff", borderRadius: 4 }}
            >
              LIVE TV
            </span>
            <span style={{ color: "var(--nr-text-muted)", fontSize: "0.8rem", fontWeight: 400 }}>Watch live news channels</span>
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {LIVE_VIDEOS.map((video) => (
              <div
                key={video.id}
                className="flex-shrink-0 w-60 overflow-hidden snap-start nr-card"
                style={{ borderRadius: 10 }}
              >
                <iframe
                  className="w-full aspect-video"
                  src={video.embedUrl}
                  title={video.title}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <p
                  className="text-center py-2 px-3"
                  style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--nr-text-secondary)" }}
                >
                  {video.title}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ DISCOVER FEED + MOST READ SIDEBAR ══ */}
        <section className="px-3 sm:px-4 py-6 max-w-screen-xl mx-auto">
          <h2 className="nr-section-title mb-5">
            Discover Feed
          </h2>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main feed */}
            <div className="flex-1 min-w-0">
              {loading && visibleCount <= 12 ? (
                <SkeletonGrid count={6} columns={3} />
              ) : visibleArticles.length > 0 ? (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleArticles.map((article: any) => (
                      <NewsCard
                        key={article.id}
                        id={article.id}
                        title={article.title}
                        excerpt={article.excerpt || article.ai_summary || article.original_excerpt || ""}
                        category={article.category || "general"}
                        image={getImage(article)}
                        readTime={article.readTime || article.read_time || "3 min read"}
                        date={article.date || (article.published_at ? new Date(article.published_at).toLocaleDateString() : new Date().toLocaleDateString())}
                        externalLink={article.externalLink || article.external_link}
                        storyHash={article.story_hash || article.storyHash}
                        localVerifiedCount={article.local_verified_count || article.localVerifiedCount}
                        rumorFlagCount={article.rumor_flag_count || article.rumorFlagCount}
                      />
                    ))}
                  </div>

                  {visibleCount < allArticles.length && (
                    <div ref={loadMoreRef} className="py-8 text-center">
                      <div
                        className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent"
                        style={{ borderColor: "var(--nr-amber) transparent var(--nr-amber) transparent" }}
                        role="status"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12" style={{ color: "var(--nr-text-muted)" }}>
                  <p className="text-4xl mb-3">📰</p>
                  {error
                    ? <p style={{ color: "#EF4444", fontWeight: 600 }}>{error}</p>
                    : <p>No articles yet. Check back soon!</p>
                  }
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
          <div className="px-3 sm:px-4 max-w-screen-xl mx-auto"><LazyAd /></div>
        </section>
      </main>

      {/* ══ FLOATING ACTION BUTTON ══ */}
      <div
        className="fixed right-4 md:right-8 z-[999] flex flex-col items-end gap-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
      >
        <div
          className={`flex flex-col items-end gap-3 transition-all duration-200 origin-bottom-right ${
            fabOpen ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 translate-y-2 scale-95 pointer-events-none"
          }`}
        >
          <button
            onClick={() => { setIsAiSearchOpen(true); setFabOpen(false); }}
            aria-label="Open AI search"
            className="h-11 rounded-full text-black font-bold text-sm flex items-center gap-2 px-4 transition-transform duration-150 hover:scale-105 active:scale-95"
            style={{ background: "var(--nr-amber)", boxShadow: "0 6px 24px rgba(245,158,11,0.4)" }}
          >
            <Search className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">AI Search</span>
          </button>
          <button
            onClick={() => { navigate("/wire"); setFabOpen(false); }}
            aria-label="Open Live Broadcast Wire"
            className="h-11 rounded-full flex items-center gap-2 px-4 transition-transform duration-150 hover:scale-105 active:scale-95"
            style={{
              background: "rgba(10,10,15,0.92)",
              border: "1px solid rgba(58,51,69,0.8)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
            }}
          >
            <span style={{ color: "var(--nr-amber)", fontWeight: 800, fontSize: "0.8rem" }}>📢</span>
            <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: 700 }} className="whitespace-nowrap">Live Wire</span>
            <span className="w-[7px] h-[7px] rounded-full animate-pulse shrink-0" style={{ background: "var(--nr-amber)" }} />
          </button>
        </div>

        <button
          onClick={() => setFabOpen(o => !o)}
          aria-label={fabOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={fabOpen}
          className="h-14 w-14 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{ background: "var(--nr-amber)", boxShadow: "0 6px 24px rgba(245,158,11,0.5)" }}
        >
          <Search className={`w-6 h-6 transition-transform duration-300 text-black ${fabOpen ? "rotate-90 scale-90" : ""}`} />
        </button>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
