import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { History, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReadingHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('reading_history') || '[]');
      // Sort by most recently read
      setHistory(stored.sort((a: any, b: any) => b.readAt - a.readAt));
    } catch (err) {
      console.error('Failed to load reading history', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = () => {
    localStorage.removeItem('reading_history');
    setHistory([]);
    toast({ title: "Reading history cleared" });
  };

  const handleRead = (article: any) => {
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Reading History</h1>
              <p className="text-muted-foreground mt-1">Articles you've read recently.</p>
            </div>
          </div>
          {history.length > 0 && (
            <button 
              onClick={clearHistory}
              className="flex items-center gap-2 px-4 py-2 text-sm text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-full transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear History
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No reading history yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              When you read articles, they will appear here so you can easily find them again.
            </p>
            <button onClick={() => navigate('/news')} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium">
              Start Reading
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {history.map((article, index) => (
              <div 
                key={`${article.id}-${index}`} 
                onClick={() => handleRead(article)}
                className="group flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors cursor-pointer"
              >
                {article.image ? (
                  <img src={article.image} alt="" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted-foreground/10 rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm sm:text-base leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(article.readAt).toLocaleDateString()} at {new Date(article.readAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
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
