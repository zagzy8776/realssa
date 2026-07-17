import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllOfflineArticles, deleteOfflineArticle, OfflineArticle } from '@/lib/ReadingListStore';
import { Bookmark, Clock, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReadingList() {
  const [articles, setArticles] = useState<OfflineArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const saved = await getAllOfflineArticles();
      setArticles(saved.sort((a, b) => b.savedAt - a.savedAt));
    } catch (err) {
      console.error('Failed to load reading list', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteOfflineArticle(id);
      setArticles(prev => prev.filter(a => a.id !== id));
      toast({ title: "Removed from offline reading" });
    } catch (err) {
      console.error('Failed to remove article', err);
    }
  };

  const handleRead = (article: OfflineArticle) => {
    // If we have full HTML content saved, we can view it directly.
    // RealSSA uses the ID to fetch from DB, but we want offline reading.
    // We pass a special flag or we just navigate to article and let it pull from offline DB if offline.
    // For now, we navigate to the standard reader. The ArticlePage handles offline fallback if implemented.
    if (article.externalLink) {
      navigate(`/read?url=${encodeURIComponent(article.externalLink)}&category=${encodeURIComponent(article.category)}&id=${encodeURIComponent(article.id)}`);
    } else {
      navigate(`/article/${article.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8 border-b border-border pb-4">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Bookmark className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Wisdom Library</h1>
            <p className="text-muted-foreground mt-1">Available offline. Read anywhere, anytime.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading your library...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Your library is empty</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Save articles to read them later when you're offline or traveling.
            </p>
            <button onClick={() => navigate('/news')} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium">
              Explore News
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {articles.map(article => (
              <div 
                key={article.id} 
                onClick={() => handleRead(article)}
                className="group flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-card border border-border hover:shadow-md transition-all cursor-pointer"
              >
                {article.image && (
                  <div className="w-full sm:w-48 h-48 sm:h-32 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={article.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <button 
                      onClick={(e) => handleRemove(e, article.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors flex-shrink-0"
                      title="Remove from library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.excerpt}</p>
                  
                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                        {article.category.toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Saved {new Date(article.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {article.externalLink && <ExternalLink className="w-3 h-3 opacity-50" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
