import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import NewsCard from "@/components/NewsCard";
import RSSArticlePreview from "@/components/RSSArticlePreview";
import ExternalArticleComments from "@/components/ExternalArticleComments";
import { NewsItem } from "@/data/newsData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Share2, Facebook, Twitter, Mail, Copy, Heart, MessageCircle, Send } from "lucide-react";

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
  const navigate = useNavigate();

  // Fetch article data
  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);

        // First try to fetch from backend API
        let apiArticles = [];
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles`);
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
          // Get related articles from same category (excluding current article)
          const related = allNews
            .filter((a: NewsItem) => a.category === foundArticle.category && a.id !== foundArticle.id)
            .slice(0, 4);
          setRelatedArticles(related);

          // Fetch comments for this article
          fetchComments(foundArticle.id);
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/comments?articleId=${articleId}`);
      if (response.ok) {
        const commentsData = await response.json();
        setComments(commentsData);
      }
    } catch (err) {
      console.warn("Failed to fetch comments:", err);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !commentAuthor.trim() || !article) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/comments`, {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/comments/${commentId}/like`, {
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
    const currentUrl = window.location.href;
    const title = encodeURIComponent(article?.title || '');
    const text = encodeURIComponent(article?.excerpt || '');

    switch (platform) {
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
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{error}</h2>
          <Button onClick={() => navigate('/')} variant="outline">
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
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <article className="max-w-4xl mx-auto">
          {/* Back button */}
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to News
          </Button>

          {/* Category badge */}
          <div className="mb-4">
            <CategoryBadge category={article.category} />
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4 text-card-foreground">
            {article.title}
          </h1>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <span>{article.date}</span>
            <span>•</span>
            <span>{article.readTime}</span>
          </div>

          {/* Featured Image */}
          <div className="mb-8">
            <img
              src={article.image}
              alt={article.title}
              className="w-full h-64 md:h-96 object-cover rounded-xl"
            />
          </div>

          {/* Content */}
          <div className="prose max-w-none prose-invert">
            <p className="text-lg mb-4 leading-relaxed">{article.excerpt}</p>

            {/* Full content would go here in future */}
            <div className="mt-8 p-4 bg-card/50 rounded-lg border border-border">
              <p className="text-muted-foreground text-sm">
                This is a preview of the article. In a full implementation, the complete article content would appear here.
              </p>
            </div>
          </div>

          {/* Social Sharing Section */}
          <div className="mt-12 border-t border-border pt-8">
            <h3 className="text-lg font-semibold mb-4">Share this article</h3>
            <div className="flex flex-wrap gap-3">
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
    </div>
  );
};

export default ArticlePage;
