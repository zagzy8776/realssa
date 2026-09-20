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
            image: fallbackImage || undefined,
            title: fallbackTitle || undefined,
          })
        });

        const data = await response.json().catch(() => ({} as any));

        if (!response.ok || !data?.content) {
          if (fallbackExcerpt && fallbackExcerpt.length > 40) {
            setArticle({
              title: fallbackTitle || "Article",
              content: `<p>${fallbackExcerpt}</p>`,
              textContent: fallbackExcerpt,
              length: fallbackExcerpt.length,
              excerpt: fallbackExcerpt.slice(0, 240),
              byline: "",
              dir: "ltr",
              siteName: "",
              lang: "en",
              publishedTime: "",
              image: fallbackImage,
              partial: true,
            });
            fetchRelatedNews();
            return;
          }
          throw new Error((data as any)?.error || "Failed to extract");
        }

        setArticle(data);
        fetchRelatedNews();
      } catch (err) {
        console.error("Extraction error:", err);
        if (fallbackExcerpt && fallbackExcerpt.length > 40) {
          setArticle({
            title: fallbackTitle || "Article",
            content: `<p>${fallbackExcerpt}</p>`,
            textContent: fallbackExcerpt,
            length: fallbackExcerpt.length,
            excerpt: fallbackExcerpt.slice(0, 240),
            byline: "",
            dir: "ltr",
            siteName: "",
            lang: "en",
            publishedTime: "",
            image: fallbackImage,
            partial: true,
          });
          setError(false);
        } else {
          setError(true);
          toast({
            title: "Reader Mode limited",
            description: "Open the original source to read the full article.",
            variant: "destructive"
          });
        }
      } finally {
        setLoading(false);
      }
    };

    runExtract();
  }, [url, navigate, toast, fallbackExcerpt, fallbackImage, fallbackTitle]);

  const fetchRelatedNews = async () => {
    try {
      let catSlug = fallbackCategory ? fallbackCategory.toLowerCase().replace(/\s+/g, '-') : '';
      if (catSlug.includes('nigeria') || catSlug.includes('nigerian')) {
        catSlug = 'nigerian';
      }
      const catEndpoint = catSlug && catSlug !== 'news'
        ? `/api/news/${catSlug}`
        : '/api/articles/featured';
      const response = await fetch(apiUrl(catEndpoint));
      if (response.ok) {
        const data = await response.json();
        const articles = Array.isArray(data) ? data : (data.articles || []);
        const filtered = articles
          .filter((a: any) => a.externalLink !== url && a.image)
          .sort(() => 0.5 - Math.random())
          .slice(0, 4);
        setRelatedNews(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    await shareContent({
      title: article?.title || fallbackTitle || 'RealSSA News',
      text: article?.excerpt || fallbackExcerpt || '',
      url: url || window.location.href,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-3xl mx-auto px-4 py-20 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            <div className="h-64 bg-muted rounded" />
          </div>
          <p className="mt-6 text-muted-foreground">Loading article…</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-3xl mx-auto px-4 py-20 flex flex-col items-center text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Full text unavailable</h2>
          <p className="text-muted-foreground mb-6 max-w-md">We could not load the full article body from this publisher right now. Open the original source, or go back and try another story.</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold"
              >
                <ExternalLink className="w-4 h-4" /> Read Original Source
              </a>
            )}
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border"
            >
              <ArrowLeft className="w-4 h-4" /> Back to News
            </button>
          </div>
        </div>
      </div>
    );
  }

  const heroImage = article.image || fallbackImage;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <article className="container max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span className="uppercase tracking-wide text-amber-500 font-semibold">{fallbackCategory}</span>
          {article.siteName && <span>· {article.siteName}</span>}
          {article.partial && <span className="text-amber-500">· Preview</span>}
        </div>

        <h1 className="text-2xl md:text-4xl font-bold leading-tight mb-4">
          {decodeHTMLEntities(article.title || fallbackTitle)}
        </h1>

        <div className="flex items-center gap-3 mb-6 text-sm text-muted-foreground">
          {article.byline && <span>{article.byline}</span>}
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
