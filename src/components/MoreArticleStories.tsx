import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import NewsCard from './NewsCard';
import type { ComponentProps } from 'react';
import { apiUrl } from '@/lib/api-base';

interface Story {
  id: string;
  title: string;
  externalLink?: string;
  image?: string;
  excerpt?: string;
  category?: ComponentProps<typeof NewsCard>['category'];
  date?: string;
  publishedAt?: string;
  source_name?: string;
  author?: string;
  readTime?: string;
  external_link?: string;
}

export default function MoreArticleStories({ excludeIds, excludeUrls, initialStories = [] }: {
  initialStories?: Story[];
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
    if (typeof IntersectionObserver === "undefined" || !sentinel.current || isFetching || isError || (started && !hasNextPage)) return;
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
  const stories = [...initialStories, ...(feed.data?.pages.flatMap(page => page.articles) || [])].map(item => ({ ...item, externalLink: item.externalLink || item.external_link })).filter(item => {
    if (!item.id || !item.title || ids.has(String(item.id)) || (item.externalLink && urls.has(item.externalLink))) return false;
    ids.add(String(item.id));
    if (item.externalLink) urls.add(item.externalLink);
    return true;
  });
  return <section id="more-articles" className="mt-10 border-t border-border pt-6" aria-label="More articles">
    <h2 className="text-2xl font-bold mb-4">More stories</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      {stories.map(item => <NewsCard key={item.id} id={item.id} title={item.title} image={item.image || ''}
        excerpt={item.excerpt || ''} category={item.category || 'general'} readTime={item.readTime || '3 min'}
        date={item.date || item.publishedAt || ''} externalLink={item.externalLink} sourceName={item.source_name || item.author} />)}
    </div>
    <div ref={sentinel} className="py-4">
      {isFetching ? <span role="status">Loading articles…</span> : isError || ((!started || hasNextPage) && typeof IntersectionObserver === "undefined") ?
        <button onClick={() => !started ? setStarted(true) : hasNextPage ? fetchNextPage() : feed.refetch()} className="min-h-11 text-primary">
          {isError ? 'Retry loading articles' : 'Load more articles'}
        </button> : !hasNextPage && started ? <p>You’ve reached the end of the current feed.</p> : null}
    </div>
  </section>;
}
