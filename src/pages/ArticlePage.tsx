import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import { NewsItem } from "@/data/newsData";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);

        // Import static data dynamically to avoid circular dependencies
        const { latestStories, nigeriaNews } = await import('@/data/newsData');

        // Try to fetch from backend API first
        let apiArticles = [];
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles`);
          if (response.ok) {
            apiArticles = await response.json();
          }
        } catch (apiError) {
          console.warn("API fetch failed, using fallback data:", apiError);
        }

        // Get user news from localStorage as fallback
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');

        // Combine all news sources
        const allNews = [...latestStories, ...nigeriaNews, ...apiArticles, ...userNews];

        // Find the article by ID
        const foundArticle = allNews.find((item: NewsItem) => item.id === id || item.id.toString() === id);

        if (foundArticle) {
          setArticle(foundArticle);
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
        </article>
      </div>
    </div>
  );
};

export default ArticlePage;