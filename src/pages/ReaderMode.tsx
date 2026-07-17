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
}

const ReaderMode = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const url = searchParams.get("url");
  const fallbackImage = searchParams.get("image");
  const fallbackCategory = searchParams.get("category") || "News";
  
  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [relatedNews, setRelatedNews] = useState<any[]>([]);
  const [viewCount, setViewCount] = useState<number | null>(null);

  // Track view count using article id from URL param
  useEffect(() => {
    const articleId = searchParams.get('id');
    if (!articleId) return;
    fetch(apiUrl(`/api/articles/${articleId}/view`), { method: 'POST' })
      .then(r => r.json())
      .then(d => setViewCount(d.views))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!url) {
      navigate("/");
      return;
    }

    const extractArticle = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await fetch(apiUrl("/api/extract"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });

        if (!response.ok) {
          throw new Error("Failed to extract");
        }

        const data = await response.json();
        setArticle(data);

        // Fetch related news for the rabbit hole
        fetchRelatedNews();
      } catch (err) {
        console.error("Extraction error:", err);
        setError(true);
        // Fallback: show error UI with button instead of redirecting
        toast({
          title: "Extraction Blocked",
          description: "Publisher prevented Reader Mode.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    extractArticle();
  }, [url, navigate, toast]);

  const fetchRelatedNews = async () => {
    try {
      // Normalize and map categories to match backend routes
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
        // Exclude current article, shuffle, take 4
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
      title: article?.title || "Read this article on RealSSA",
      url: window.location.href,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-medium animate-pulse text-center">Loading Clean Reader Mode...</p>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-sm">Stripping away ads and popups for a perfect reading experience.</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Extraction Blocked</h2>
          <p className="text-muted-foreground mb-6 max-w-md">The publisher of this article prevents Reader Mode extraction. You can still read it directly on their website.</p>
          <a href={url!} target="_blank" rel="noopener noreferrer" className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-md hover:bg-primary/90 flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Read Original Source
          </a>
          <button onClick={() => navigate(-1)} className="mt-6 text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to News
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <Header />
      
      {/* Top Navigation Bar */}
      <div className="sticky top-[60px] md:top-[80px] z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to News
        </button>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent((article?.title || '') + ' — Read on RealSSA: ' + window.location.href)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-green-500/20 transition-colors text-green-500 flex items-center gap-1 text-sm font-medium"
            title="Share on WhatsApp"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
          <a 
            href={url!} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-primary flex items-center gap-2 text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Original
          </a>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <span className="text-primary font-semibold text-sm uppercase tracking-wider mb-3 block">
          {fallbackCategory || "News"}
        </span>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display leading-tight mb-6 selectable-text">
          {decodeHTMLEntities(article.title)}
        </h1>
        
        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
          <span className="border-l-2 border-primary pl-3">By RealSSA Editor</span>
          {typeof viewCount === 'number' && (
            <span className="flex items-center gap-1 font-medium text-primary">
              👁 {viewCount.toLocaleString()} views
            </span>
          )}
        </div>

        {fallbackImage && !imgError && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden mb-10 shadow-2xl bg-muted">
            <img 
              src={fallbackImage} 
              alt={article.title} 
              className="w-full h-full object-cover" 
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <div 
          className="prose prose-lg dark:prose-invert max-w-none 
                     prose-headings:font-display prose-headings:font-bold
                     prose-a:text-primary hover:prose-a:text-primary/80
                     prose-img:rounded-xl prose-img:shadow-lg prose-img:w-full
                     leading-relaxed text-gray-800 dark:text-gray-200 selectable-text"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
        />

        {/* Disclaimer */}
        <div className="mt-12 p-6 bg-muted/50 rounded-2xl border border-border text-sm text-muted-foreground text-center">
          <p>Curated by the RealSSA News Desk to bring you the best ad-free reading experience.</p>
          <a href={url!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium mt-2 inline-block">
            View original source on {article.siteName || "the publisher's website"}
          </a>
        </div>
        
        {/* Comments Section */}
        <div className="mt-16">
          <ExternalArticleComments 
            articleId={btoa(url!).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-')} 
            articleTitle={article.title} 
          />
        </div>
      </article>

      {/* Rabbit Hole (Keep Reading) */}
      {relatedNews.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12 border-t border-border mt-8">
          <h3 className="text-2xl font-bold font-display mb-6 flex items-center gap-2">
            <span className="w-2 h-6 bg-primary rounded-full"></span>
            You May Also Like
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedNews.map((news) => (
              <NewsCard
                key={news.id}
                id={news.id}
                title={news.title}
                excerpt={news.excerpt}
                category={news.category}
                image={news.image}
                readTime={news.readTime}
                date={news.date}
                externalLink={news.externalLink}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ReaderMode;
