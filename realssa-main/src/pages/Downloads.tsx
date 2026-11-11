import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import {
  getAllOfflineArticles,
  deleteOfflineArticle,
  OfflineArticle,
} from "@/lib/ReadingListStore";
import { Download, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Downloads() {
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
      console.error("Failed to load downloads", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteOfflineArticle(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Removed from downloads" });
    } catch (err) {
      console.error("Failed to remove download", err);
    }
  };

  const handleOpen = (article: OfflineArticle) => {
    if (article.externalLink) {
      navigate(
        `/read?url=${encodeURIComponent(article.externalLink)}&category=${encodeURIComponent(article.category)}&id=${encodeURIComponent(article.id)}`
      );
    } else {
      navigate(`/article/${article.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <div className="p-3 rounded-xl bg-amber-500/15">
            <Download className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Downloads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Saved for offline reading
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading downloads…</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <Download className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No downloads yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Bookmark or save articles to keep them here for offline.
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2 bg-amber-500 text-black rounded-full font-bold text-sm"
            >
              Browse Home
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <button
                key={article.id}
                type="button"
                onClick={() => handleOpen(article)}
                className="w-full flex items-start gap-3 p-3 rounded-2xl border border-border bg-card/40 hover:border-amber-500/40 text-left transition"
              >
                {article.image ? (
                  <img
                    src={article.image}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-muted"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold line-clamp-2">{article.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {article.category} · Offline ready
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, article.id)}
                  className="p-2 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Remove download"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
