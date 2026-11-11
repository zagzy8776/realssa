import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Share2, AlertCircle } from "lucide-react";
import { apiUrl } from "@/lib/api-base";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { shareContent } from "@/lib/share";
import NewsCard from "@/components/NewsCard";
import ExternalArticleComments from "@/components/ExternalArticleComments";
import DOMPurify from "dompurify";
import { decodeHTMLEntities } from "@/lib/utils";
import { useDwellTime } from "@/hooks/useDwellTime";

interface ExtractedArticle {
  title: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline: string;
  dir: string;
  siteName: string;
  lang: string;
  publishedTime: string;
  image?: string | null;
  partial?: boolean;
}

const ReaderMode = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const url = searchParams.get("url");
  const fallbackImage = searchParams.get("image");
  const fallbackCategory = searchParams.get("category") || "News";
  const fallbackExcerpt = searchParams.get("excerpt") || searchParams.get("summary") || "";
  const fallbackTitle = searchParams.get("title") || "";
  
  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [relatedNews, setRelatedNews] = useState<any[]>([]);
  const [viewCount, setViewCount] = useState<number | null>(null);

  const articleId = searchParams.get('id') || undefined;
  useDwellTime(fallbackCategory || 'news', articleId);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    fetch(apiUrl(`/api/articles/${id}/view`), { method: 'POST' })
      .then(r => r.json())
      .then(d => setViewCount(d.views))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!url) {
      navigate("/");
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const runExtract = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await fetch(apiUrl("/api/extract"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            fallbackText: fallbackExcerpt || undefined,
            fallbackImage: fallbackImage || undefined,
            fallbackTitle: fallbackTitle || undefined,
            excerpt: fallbackExcerpt || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Extract failed");
        }

        const data = await response.json();
        
        // Always prefer extracted content; fall back to RSS/query params
        const resolved: ExtractedArticle = {
          title: data.title || fallbackTitle || "Article",
          content: data.content || (fallbackExcerpt ? `<p>${fallbackExcerpt}</p>` : "<p>Content could not be extracted. Please visit the original source.</p>"),
          textContent: data.textContent || fallbackExcerpt || "",
          length: data.length || 0,
          excerpt: data.excerpt || fallbackExcerpt || "",
          byline: data.byline || "",
          dir: data.dir || "ltr",
          siteName: data.siteName || "",
          lang: data.lang || "en",
          publishedTime: data.publishedTime || "",
          image: data.image || fallbackImage || null,
          partial: data.partial || !data.content,
        };

        setArticle(resolved);
      } catch (err) {
        console.error("ReaderMode extract error:", err);
        // Soft-fail: still show something useful from RSS fallbacks
        setArticle({
          title: fallbackTitle || "Article",
          content: fallbackExcerpt ? `<p>${fallbackExcerpt}</p><p class=\"text-muted-foreground\">Full extraction unavailable. Use the source link below.</p>` : "<p>Unable to load article content. Please open the original source.</p>",
          textContent: fallbackExcerpt || "",
          length: 0,
          excerpt: fallbackExcerpt || "",
          byline: "",
          dir: "ltr",
          siteName: "",
          lang: "en",
          publishedTime: "",
          image: fallbackImage || null,
          partial: true,
        });
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    runExtract();

    // Related news
    const loadRelated = async () => {
      try {
        const res = await fetch(apiUrl(`/api/news?limit=6&category=${encodeURIComponent(fallbackCategory)}`));
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.articles || data.items || []);
          setRelatedNews(items.slice(0, 4));
        }
      } catch {}
    };
    loadRelated();
  }, [url, navigate, fallbackExcerpt, fallbackImage, fallbackTitle, fallbackCategory]);

  const handleShare = async () => {
    const title = article?.title || fallbackTitle || "Article";
    const shareUrl = window.location.href;
    await shareContent({
      title,
      text: article?.excerpt || fallbackExcerpt || title,
      url: shareUrl,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-64 bg-muted rounded-xl" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold mb-2">Unable to load article</h1>
          <button onClick={() => navigate(-1)} className="text-primary hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  const heroImage = article.image || fallbackImage;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <article className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl md:text-4xl font-bold font-display leading-tight mb-4">
          {decodeHTMLEntities(article.title)}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
          {article.siteName && <span>{article.siteName}</span>}
          {article.byline && <span>· {article.byline}</span>}
          {viewCount != null && <span>· {viewCount} views</span>}
          <button onClick={handleShare} className="inline-flex items-center gap-1 hover:text-foreground ml-auto">
            <Share2 className="w-4 h-4" /> Share
          </button>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="w-4 h-4" /> Source
            </a>
          )}
        </div>

        {heroImage && !imgError && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img
              src={heroImage}
              alt={article.title || ''}
              className="w-full max-h-[420px] object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <div
          className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-display prose-a:text-primary mb-12"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content || '') }}
        />

        {url && (
          <div className="mb-12">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold"
            >
              <ExternalLink className="w-4 h-4" /> Read on original site
            </a>
          </div>
        )}

        {articleId && <ExternalArticleComments articleId={articleId} />}

        {relatedNews.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold mb-4">More stories</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {relatedNews.map((news: any) => (
                <NewsCard
                  key={news.id || news.externalLink}
                  id={news.id}
                  title={news.title}
                  excerpt={news.excerpt || ''}
                  category={(news.category || fallbackCategory) as any}
                  image={news.image}
                  readTime={news.readTime || '3 min'}
                  date={news.date || news.publishedAt || ''}
                  externalLink={news.externalLink}
                  sourceName={news.sourceName || news.author}
                />
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
};

export default ReaderMode;
