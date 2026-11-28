import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiUrl } from '@/lib/api-base';
import { cleanText, decodeHTMLEntities } from '@/lib/utils';

interface Story {
  id: string;
  title: string;
  externalLink?: string;
  image?: string;
  excerpt?: string;
  category?: string;
}

export default function MoreArticleStories({ excludeIds, excludeUrls }: {
  excludeIds: (string | undefined)[];
  excludeUrls: (string | null | undefined)[];
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const feed = useInfiniteQuery({
    queryKey: ['reader-more-stories'],
    initialPageParam: '0',
    enabled: started,
    staleTime: 60000,
    retry: false,
    queryFn: async ({ pageParam, signal }): Promise<{ articles: Story[]; nextCursor: string | null }> => {
      const params = new URLSearchParams({ limit: '12', candidates: '1', cursor: pageParam });
      const response = await fetch(apiUrl(`/api/feed/foryou?${params}`), { signal });
      if (!response.ok) throw new Error('Feed unavailable');
      const data = await response.json();
      if (!Array.isArray(data.articles)) throw new Error('Invalid feed');
      return data;
    },
    getNextPageParam: page => page.nextCursor || undefined,
  });
  const { hasNextPage, fetchNextPage, isFetching, isError } = feed;
  useEffect(() => {
    if (!sentinel.current || isFetching || isError || (started && !hasNextPage)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      if (!started) setStarted(true);
      else void fetchNextPage({ cancelRefetch: false });
    }, { rootMargin: '320px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [started, hasNextPage, fetchNextPage, isFetching, isError]);

  const ids = new Set(excludeIds.filter(Boolean).map(String));
  const urls = new Set(excludeUrls.filter(Boolean));
  const stories = (feed.data?.pages.flatMap(page => page.articles) || []).filter(item => {
    if (!item.id || !item.title || ids.has(String(item.id)) || (item.externalLink && urls.has(item.externalLink))) return false;
    ids.add(String(item.id));
    if (item.externalLink) urls.add(item.externalLink);
    return true;
  });
  return <section id="more-articles" className="mt-10 border-t border-border pt-6" aria-label="More articles">
    <h2 className="text-2xl font-bold">More articles</h2>
    {stories.map(item => {
      const params = new URLSearchParams({ url: item.externalLink || '', id: String(item.id), title: item.title,
        excerpt: cleanText(item.excerpt || '', 500), image: item.image || '', category: item.category || 'news' });
      return <Link key={item.id} className="block border-b border-border py-4" to={item.externalLink ? `/read?${params}` : `/article/${encodeURIComponent(item.id)}`}>
        <strong>{decodeHTMLEntities(item.title)}</strong>
        <span className="block text-sm text-primary">Read more →</span>
      </Link>;
    })}
    <div ref={sentinel} className="py-4">
      {isFetching ? <span role="status">Loading articles…</span> : !started || hasNextPage || isError ?
        <button onClick={() => !started ? setStarted(true) : hasNextPage ? fetchNextPage() : feed.refetch()} className="min-h-11 text-primary">
          {isError ? 'Retry loading articles' : 'Load more articles'}
        </button> : <p>You’ve reached the end of the current feed.</p>}
    </div>
  </section>;
}
