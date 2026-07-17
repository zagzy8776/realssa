import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Eye } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';

interface Article {
  id: string;
  title: string;
  image: string;
  category: string;
  date: string;
  externalLink: string;
  views: number;
}

export default function MostRead() {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    fetch(apiUrl('/api/articles/most-read'))
      .then(r => r.ok ? r.json() : [])
      .then(data => setArticles(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, []);

  if (articles.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Most Read This Week
      </h3>
      <ol className="space-y-4">
        {articles.map((article, i) => (
          <li key={article.id}>
            <Link
              to={`/read?url=${encodeURIComponent(article.externalLink)}&image=${encodeURIComponent(article.image || '')}&category=${encodeURIComponent(article.category)}&id=${encodeURIComponent(article.id)}`}
              className="flex gap-3 group"
            >
              <span className="text-3xl font-black text-muted-foreground/30 leading-none w-7 shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Eye className="w-3 h-3" />
                  {article.views.toLocaleString()} views
                </span>
              </div>
              {article.image && (
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-16 h-12 object-cover rounded-lg shrink-0"
                  loading="lazy"
                />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
