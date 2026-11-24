import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CategoryBadge from "@/components/CategoryBadge";
import { CategoryType } from "@/data/newsData";
import { cleanText } from '@/lib/utils';

interface HeadlineItem {
  id: string;
  title: string;
  category: CategoryType;
  image: string;
  excerpt: string;
  date: string;
  readTime: string;
  externalLink?: string;
}

const RotatingHeadlines = () => {
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeadlines = async () => {
      try {
        const res = await fetch(apiUrl('/api/articles?limit=8&featured=1'));
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.articles || data.data || [];
        setHeadlines(list.slice(0, 8).map((a: any) => ({
          id: a.id,
          title: a.title,
          category: a.category || 'news',
          image: a.image || '/logo.png',
          excerpt: a.excerpt || a.description || '',
          date: a.date || a.published_at || '',
          readTime: a.readTime || '3 min read',
          externalLink: a.externalLink || a.external_link,
        })));
      } catch {
        setHeadlines([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHeadlines();
  }, []);

  useEffect(() => {
    if (headlines.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(i => (i + 1) % headlines.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [headlines.length]);

  if (loading || headlines.length === 0) return null;

  const currentHeadline = headlines[currentIndex];

  const goPrev = () => setCurrentIndex(i => (i - 1 + headlines.length) % headlines.length);
  const goNext = () => setCurrentIndex(i => (i + 1) % headlines.length);

  return (
    <section className="px-3 sm:px-4 py-4">
      <Card className="overflow-hidden border-border/40 bg-card/50 backdrop-blur">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-1/2 relative aspect-[16/10] md:aspect-auto md:min-h-[280px]">
              <img
                src={currentHeadline.image}
                alt={cleanText(currentHeadline.title)}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="md:w-1/2 p-8">
              <div className="flex items-center gap-4 mb-4">
                <CategoryBadge category={currentHeadline.category} />
                <span className="text-sm text-muted-foreground">{currentHeadline.date}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{currentHeadline.readTime}</span>
              </div>

              <h3 className="text-2xl font-bold mb-4 line-clamp-3">
                {cleanText(currentHeadline.title)}
              </h3>

              <p className="text-muted-foreground mb-6 line-clamp-4">
                {cleanText(currentHeadline.excerpt)}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Link to={`/article/${currentHeadline.id}`}>
                    <Button variant="outline">Read Full Story</Button>
                  </Link>
                  {currentHeadline.externalLink && (
                    <Link
                      to={`/read?url=${encodeURIComponent(currentHeadline.externalLink)}&category=${encodeURIComponent(currentHeadline.category || 'news')}&id=${encodeURIComponent(currentHeadline.id || '')}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-sm font-medium transition-colors"
                    >
                      🎬 Watch AI Breakdown
                    </Link>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={goPrev} aria-label="Previous">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={goNext} aria-label="Next">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-1.5 mt-4">
                {headlines.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default RotatingHeadlines;
