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

const Trending: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [pool, setPool] = useState<Article[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const deviceId =
    typeof window !== "undefined"
      ? localStorage.getItem("realssa_device_uuid") || ""
      : "";

  const loadPool = useCallback(async () => {
    setLoading(true);
    try {
      const qs = deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : "";
      const endpoints = [
        `/api/articles/trending?diverse=true${qs}`,
        `/api/news/breaking?diverse=true${qs}`,
        `/api/articles?limit=50`,
        `/api/news/nigerian-news`,
        `/api/news/world`,
        `/api/news/sports`,
      ];

      const results = await Promise.allSettled(
        endpoints.map((path) => fetch(apiUrl(path)).then((r) => (r.ok ? r.json() : [])))
      );

      const merged: Article[] = [];
      const seen = new Set<string>();
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const list = Array.isArray(result.value) ? result.value : [];
        for (const item of list) {
          const id = String(item.id || item.externalLink || item.title);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push(item);
        }
      }

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
  }, [deviceId]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        const next = page + 1;
        const slice = pool.slice(0, (next + 1) * PAGE_SIZE);
        setArticles(slice);
        setPage(next);
        setHasMore(slice.length < pool.length);
        setLoadingMore(false);
      },
      { rootMargin: "200px" }
    );
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
              <p className="text-sm text-muted-foreground mt-0.5">
                What’s rising across Africa and the world
              </p>
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
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No trending stories yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Check back soon or browse Home.</p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2 bg-amber-500 text-black rounded-full font-bold text-sm"
            >
              Back to Home
            </button>
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
                readTime={article.readTime || "5 min read"}
                date={article.date}
                externalLink={article.externalLink}
                showBookmark
              />
            ))}
            <div ref={loaderRef} className="h-8" />
            {loadingMore && (
              <div className="text-center text-xs text-muted-foreground py-3">Loading more…</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Trending;
