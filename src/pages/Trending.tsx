import { apiUrl } from "@/lib/api-base";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import NewsCard from "@/components/NewsCard";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
  author?: string;
  externalLink?: string;
  source?: string;
}

const PAGE_SIZE = 20;

const normalize = (item: any): Article => ({
  id: String(item.id || item.external_link || item.externalLink || item.title),
  title: String(item.title || "Trending story"),
  excerpt: String(item.excerpt || item.description || `Trending now in ${item.country || "the world"}.`),
  category: String(item.category || "Trending"),
  image: String(item.image || "https://realssanews.com.ng/logo.png"),
  readTime: String(item.readTime || "1 min read"),
  date: String(item.date || item.published_at || new Date().toISOString()),
  author: item.author || item.source_name || "RealSSA Trends",
  externalLink: item.externalLink || item.external_link,
  source: item.source || item.source_name,
});

const Trending: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [pool, setPool] = useState<Article[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadPool = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/trending?limit=100`), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      let raw: any[] = [];
      if (response.ok) {
        const payload = await response.json();
        raw = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.articles)
            ? payload.articles
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
      }

      // /api/trending is RSS-backed and can legitimately return an empty set
      // when a feed provider blocks the request. Never leave Trending blank:
      // fall back to the same live article feed used by Home.
      if (raw.length === 0) {
        const fallback = await fetch(apiUrl(`/api/articles?limit=100`), {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (fallback.ok) {
          const data = await fallback.json();
          raw = Array.isArray(data)
            ? data
            : Array.isArray(data?.articles)
              ? data.articles
              : [];
        }
      }

      const seen = new Set<string>();
      const merged = raw
        .map(normalize)
        .filter((item: Article) => {
          const key = item.id || item.title;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a: Article, b: Article) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setPool(merged);
      setArticles(merged.slice(0, PAGE_SIZE));
      setPage(0);
      setHasMore(merged.length > PAGE_SIZE);
    } catch (err) {
      console.error("Trending load failed", err);
      setPool([]);
      setArticles([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPool(); }, [loadPool]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || loadingMore) return;
      setLoadingMore(true);
      const next = page + 1;
      const slice = pool.slice(0, (next + 1) * PAGE_SIZE);
      setArticles(slice);
      setPage(next);
      setHasMore(slice.length < pool.length);
      setLoadingMore(false);
    }, { rootMargin: "200px" });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, pool]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/15">
              <TrendingUp className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold">Trending</h1>
              <p className="text-sm text-muted-foreground mt-0.5">What’s rising across Africa and the world</p>
            </div>
          </div>
          <button
            onClick={loadPool}
            className="p-2.5 rounded-full border border-border text-muted-foreground hover:text-amber-500 hover:border-amber-500/40 transition"
            aria-label="Refresh trending"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No trending stories yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Check back soon or browse Home.</p>
            <button onClick={() => navigate("/")} className="px-6 py-2 bg-amber-500 text-black rounded-full font-bold text-sm">Back to Home</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {articles.map((article) => (
              <NewsCard
                key={article.id || article.title}
                id={article.id}
                title={article.title}
                excerpt={article.excerpt}
                category={article.category as any}
                image={article.image}
                readTime={article.readTime}
                date={article.date}
                externalLink={article.externalLink}
                showBookmark
              />
            ))}
            <div ref={loaderRef} className="h-8" />
            {loadingMore && <div className="text-center text-xs text-muted-foreground py-3">Loading more…</div>}
          </div>
        )}
      </main>
    </div>
  );
};

export default Trending;
