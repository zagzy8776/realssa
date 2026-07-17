import { apiUrl } from '@/lib/api-base';
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import CategoryBadge from "@/components/CategoryBadge";
import NewsCard from "@/components/NewsCard";
import RSSArticlePreview from "@/components/RSSArticlePreview";
import ExternalArticleComments from "@/components/ExternalArticleComments";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LiveReacts from "@/components/LiveReacts";
import ReadProgressBar from "@/components/ReadProgressBar";
import SEO from "@/components/SEO";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { NewsItem } from "@/data/newsData";
import { decodeHTMLEntities } from "@/lib/utils";
import DOMPurify from 'dompurify';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldAlert, Users } from "lucide-react";
import { ArrowLeft, Share2, Facebook, Twitter, Mail, Copy, Heart, MessageCircle, Send, ExternalLink } from "lucide-react";
import { trackArticleRead } from "@/lib/userPreferences";

interface Comment {
  id: string;
  articleId: string;
  author: string;
  content: string;
  date: string;
  likes: number;
}

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<NewsItem | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userHasCommented, setUserHasCommented] = useState(false);
  const [insightText, setInsightText] = useState('');
  const [insightSaved, setInsightSaved] = useState(false);
  const [readerContent, setReaderContent] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Fetch article data
  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);

        // For rss- prefixed IDs, fetch directly from the single-article endpoint
        if (id && String(id).startsWith('rss-')) {
          try {
            const response = await fetch(apiUrl(`/api/articles/${id}`));
            if (response.ok) {
              const foundArticle = await response.json();
              setArticle(foundArticle);
              setRelatedArticles([]);
              setLoading(false);
              fetchComments(foundArticle.id);
              return;
            }
          } catch (rssErr) {
            console.warn('RSS article fetch failed:', rssErr);
          }
          setError('Article not found');
          setLoading(false);
          return;
        }

        // First try to fetch from backend API (admin articles)
        let apiArticles = [];
        try {
          const response = await fetch(apiUrl('/api/articles'));
          if (response.ok) {
            apiArticles = await response.json();
          }
        } catch (apiError) {
          console.warn("API fetch failed:", apiError);
        }

        // Get user news from localStorage as fallback
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');

        // Combine API articles and user news (prioritize API articles)
        const allNews = [...apiArticles, ...userNews];

        // Find the article by ID in admin-posted content first
        const foundArticle = allNews.find((item: NewsItem) => item.id === id || item.id.toString() === id);

        if (foundArticle) {
          setArticle(foundArticle);
          // Track reading history for personalization
          trackArticleRead({
            id: foundArticle.id,
            title: foundArticle.title,
            category: foundArticle.category || 'news',
            image: foundArticle.image,
            externalLink: foundArticle.externalLink,
          });
          // Get related articles from same category (excluding current article)
          const related = allNews
            .filter((a: NewsItem) => a.category === foundArticle.category && a.id !== foundArticle.id)
            .slice(0, 4);
          setRelatedArticles(related);

          // Fetch comments for this article
          fetchComments(foundArticle.id);

          // Smart Push Notification Tagging (Sentinel)
          setTimeout(() => {
            const OneSignal = (window as any).OneSignal;
            if (OneSignal && OneSignal.User && foundArticle.category) {
              const safeCategory = foundArticle.category.toLowerCase().replace(/[^a-z0-9]/g, '_');
              OneSignal.User.addTag(`interest_${safeCategory}`, 'true');
            }
          }, 2000);
        } else {
          setError("Article not found");
        }
      } catch (err) {
        console.error("Error fetching article:", err);
        setError("Failed to load article");
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const fetchComments = async (articleId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/comments?articleId=${articleId}`));
      if (response.ok) {
        const commentsData = await response.json();
        setComments(commentsData);
      }
    } catch (err) {
      console.warn("Failed to fetch comments:", err);
    }
  };

  // Reader View Engine Effect
  useEffect(() => {
    if (!article) return;
    
    const content = (article as any).content;
    const hasSubstantialContent = content && content.length > 500;
    
    // Trigger Reader Engine if we have an external link, lack substantial local content, and haven't tried yet
    if (article.externalLink && article.externalLink !== '#' && !hasSubstantialContent && !readerContent && !isParsing && !parseError) {
      const fetchReaderMode = async () => {
        setIsParsing(true);
        try {
          const response = await fetch(apiUrl('/api/extract'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: article.externalLink })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.content) {
              setReaderContent(data.content);
            } else {
              setParseError(true);
            }
          } else {
            setParseError(true);
          }
        } catch (err) {
          console.error('Reader extraction failed:', err);
          setParseError(true);
        } finally {
          setIsParsing(false);
        }
      };
      
      fetchReaderMode();
    }
  }, [article, readerContent, isParsing, parseError]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !commentAuthor.trim() || !article) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(apiUrl('/api/comments'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: article.id,
          author: commentAuthor.trim(),
          content: newComment.trim(),
        }),
      });

      if (response.ok) {
        const newCommentData = await response.json();
        setComments(prev => [newCommentData, ...prev]);
        setNewComment('');
        setCommentAuthor('');
      } else {
        console.error('Failed to submit comment');
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/comments/${commentId}/like`), {
        method: 'POST',
      });

      if (response.ok) {
        const updatedComment = await response.json();
        setComments(prev => prev.map(comment =>
          comment.id === commentId ? updatedComment : comment
        ));
      }
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const handleShare = async (platform: string) => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    const currentUrl = window.location.href;
    const title = encodeURIComponent(article?.title || '');
    const text = encodeURIComponent(article?.excerpt || '');
    
    // For WhatsApp share optimization
    const whatsappText = encodeURIComponent(`*${article?.title}* 📰\n${article?.excerpt}\n\nRead more on RealSSA:\n${currentUrl}`);

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${whatsappText}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${currentUrl}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${currentUrl}&text=${title}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:?subject=${title}&body=${text}%0A%0A${currentUrl}`;
        break;
    }
  };

  const handleCopyLink = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleSaveInsight = () => {
    if (insightText.trim()) {
      setInsightSaved(true);
      // In future: Save to DB/localStorage
      setTimeout(() => setInsightSaved(false), 3000);
      setInsightText('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Article skeleton */}
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="h-64 bg-muted rounded-2xl w-full" />
            <div className="space-y-3 mt-6">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-4 bg-muted rounded" style={{ width: `${100 - i * 5}%` }} />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-8">
            Loading article... If this takes a moment, the server is waking up.
          </p>
        </div>
      </div>
    );

  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{error}</h2>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Article not found</h2>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={article.title}
        description={
          (article as any).ai_summary ||
          article.excerpt ||
          `Read the full story: ${article.title} — brought to you by RealSSA News, Africa's leading news platform.`
        }
        image={article.image || undefined}
        url={
          // If it's an RSS article WITHOUT an AI summary, canonical points to original source
          // (protects against duplicate content penalty)
          // If it has an AI summary, canonical is our URL (we have unique content)
          article.source === 'rss' && !(article as any).ai_summary && article.externalLink
            ? article.externalLink
            : `https://realssanews.com.ng/article/${article.id}`
        }
        type="article"
        author="RealSSA Editor"
        publishedTime={article.date ? new Date(article.date).toISOString() : undefined}
        section={article.category || 'News'}
        tags={article.category ? [article.category, 'Africa', 'RealSSA News'] : ['Africa', 'RealSSA News']}
      />
      <ReadProgressBar />
      <Header />
      <div className="container mx-auto px-4 py-8">
        <article className="max-w-4xl mx-auto">
          {/* Category badge & Truth Index */}
          <div className="mb-6 flex items-center flex-wrap gap-3">
            <CategoryBadge category={article.category} />
            
            {/* The Truth-Index (Journalist's Moat) */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold tracking-wide">
              <ShieldCheck size={14} className="text-green-500" />
              <span>Verified Source</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4 text-card-foreground selectable-text">
            {decodeHTMLEntities(article.title)}
          </h1>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <span className="font-medium text-primary">
              Last Updated: {article.date ? (() => {
                const diff = Math.floor((new Date().getTime() - new Date(article.date).getTime()) / 60000);
                if (diff < 0) return 'Just now';
                if (diff < 60) return `${diff} minutes ago`;
                const hours = Math.floor(diff / 60);
                if (hours < 24) return `${hours} hours ago`;
                return `${Math.floor(hours / 24)} days ago`;
              })() : 'Just now'}
            </span>
            <span>•</span>
            <span>{article.date && new Date(article.date).toLocaleDateString()}</span>
            <span>•</span>
            <span>{article.readTime}</span>
          </div>

          {/* Featured Image */}
          {!imgError && article.image && (
            <div className="mb-8 bg-muted rounded-xl overflow-hidden">
              <img
                src={article.image}
                alt={article.title}
                className="w-full h-64 md:h-96 object-cover"
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Content */}
          <div className="prose max-w-none dark:prose-invert">
            {/* AI Summary (TL;DR) */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-100 dark:border-blue-900 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="text-6xl">✨</span>
              </div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-blue-800 dark:text-blue-300 mb-3 mt-0">
                <span className="animate-pulse">⚡</span> Quick Read
              </h3>
              <ul className="space-y-2 mb-0 text-foreground selectable-text">
                {(article as any).ai_summary ? (
                  // If we have an actual array of summary points from backend
                  Array.isArray((article as any).ai_summary) 
                    ? (article as any).ai_summary.map((point: string, i: number) => <li key={i}>{point}</li>)
                    : <li>{(article as any).ai_summary}</li>
                ) : (
                  // Fallback: Split excerpt into 2 pseudo-bullet points for the demo
                  <>
                    <li>{article.excerpt ? (decodeHTMLEntities(article.excerpt).split('.')[0] || decodeHTMLEntities(article.excerpt)) : "Stay updated with RealSSA News"}.</li>
                    {article.excerpt && article.excerpt.split('.').length > 1 && (
                      <li>{decodeHTMLEntities(article.excerpt).split('.').slice(1).join('.').trim() || "Stay updated with RealSSA for more details."}</li>
                    )}
                  </>
                )}
              </ul>
            </div>

            <p className="text-base md:text-lg mb-6 leading-relaxed text-foreground selectable-text">{article.excerpt}</p>
            
            {/* Reader Engine Loading State */}
            {isParsing && (
              <div className="my-12 p-8 bg-black border border-primary/20 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-5"></div>
                <h3 className="text-xl font-display font-bold text-white mb-2">Initializing Reader Mode</h3>
                <p className="text-sm text-gray-400">Stripping ads and trackers for a clean, distraction-free reading experience...</p>
              </div>
            )}

            {/* Extracted Reader Content */}
            {!isParsing && readerContent && (
              <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-display prose-a:text-primary mt-6 mb-12 reader-content-engine selectable-text"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(readerContent) }}
              />
            )}

            {/* Fallback Native Content */}
            {!isParsing && !readerContent && (
              <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-display prose-a:text-primary mt-6 mb-12 selectable-text"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((article as any).content || '') }}
              />
            )}
            
            {/* Parser Error State */}
            {parseError && !readerContent && (
              <div className="my-6 p-5 bg-red-950/20 border border-red-900/50 text-red-400 rounded-xl text-center text-sm">
                We couldn't automatically extract this article. 
                <a href={article.externalLink} target="_blank" rel="noopener noreferrer" className="underline font-bold ml-1 hover:text-red-300">Read directly on source</a>
              </div>
            )}

            {/* Ambient Presence (The Ghost Thread) */}
            <div className="flex items-center justify-center gap-2 py-8 my-8 border-t border-b border-border/40 text-muted-foreground">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </div>
              <Users size={16} className="opacity-70" />
              <span className="text-sm font-medium tracking-wide">Many others are exploring this story today.</span>
            </div>

            {/* Knowledge Synthesis (Wisdom Library) */}
            <div className="mt-8 mb-12 bg-[#111] dark:bg-black border border-border/50 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <span className="text-8xl">🧠</span>
              </div>
              <h3 className="text-xl md:text-2xl font-display font-bold text-foreground mb-2 relative z-10">Extract Insight</h3>
              <p className="text-sm text-muted-foreground mb-6 relative z-10">What does this story mean to you? Save your interpretation to your Personal Wisdom Library.</p>
              
              <div className="relative z-10">
                <textarea
                  className="w-full bg-background border border-border/50 rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-none"
                  placeholder="This reminds me that..."
                  value={insightText}
                  onChange={(e) => setInsightText(e.target.value)}
                />
                <div className="mt-4 flex justify-end">
                  <Button 
                    onClick={handleSaveInsight}
                    className="bg-primary text-primary-foreground font-bold shadow-[0_0_15px_rgba(255,215,0,0.2)] hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-shadow"
                    disabled={insightSaved || !insightText.trim()}
                  >
                    {insightSaved ? "Saved to Library ✨" : "Save Insight"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Related Videos Section */}
          {(article as any).related_videos && (article as any).related_videos.length > 0 && (
            <div className="mt-12 border-t border-border pt-8">
              <h3 className="text-xl font-bold mb-6">Related Videos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(article as any).related_videos.map((video: any) => (
                  <div key={video.id} className="bg-card rounded-xl overflow-hidden border border-border shadow-sm">
                    <iframe 
                      src={video.embedUrl} 
                      title={video.title}
                      className="w-full aspect-video" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen 
                    />
                    <div className="p-4">
                      <h4 className="font-semibold text-card-foreground line-clamp-2 text-sm">{video.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Social Sharing Section */}
          <div className="mt-12 border-t border-border pt-8">
            <h3 className="text-lg font-semibold mb-4">Share this article</h3>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => handleShare('whatsapp')}
                className="flex items-center gap-2 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border-[#25D366]/50"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => handleShare('facebook')}
                className="flex items-center gap-2"
              >
                <Facebook className="h-4 w-4" />
                Facebook
              </Button>
              <Button
                variant="outline"
                onClick={() => handleShare('twitter')}
                className="flex items-center gap-2"
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </Button>
              <Button
                variant="outline"
                onClick={() => handleShare('email')}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Copy className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Live Reacts Section */}
          <LiveReacts articleId={article.id} />

          {/* Comments Section */}
          <div className="mt-12 border-t border-border pt-8">
            <ExternalArticleComments
              articleId={article.id}
              articleTitle={article.title}
              onCommentPosted={() => {
                // Refresh comments after posting
                fetchComments(article.id);
              }}
            />
          </div>

          {/* Related Articles Section */}
          {relatedArticles.length > 0 && (
            <div className="mt-16 border-t border-border pt-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Up Next</h2>
                <Link to="/">
                  <Button variant="ghost" className="text-primary hover:text-primary/80">
                    View All Articles →
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {relatedArticles.map((relatedArticle, index) => (
                  <NewsCard
                    key={relatedArticle.id}
                    title={relatedArticle.title}
                    excerpt={relatedArticle.excerpt}
                    category={relatedArticle.category}
                    image={relatedArticle.image}
                    readTime={relatedArticle.readTime}
                    date={relatedArticle.date}
                    id={relatedArticle.id}
                    externalLink={relatedArticle.externalLink}
                  />
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
      <Footer />
    </div>
  );
};

export default ArticlePage;
