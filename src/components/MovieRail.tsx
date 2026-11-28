import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiUrl } from '@/lib/api-base';
import { normalizeFeedMatches } from '@/lib/sportsMatchNormalize';

interface Movie {
  id: number;
  title: string;
  media_type: string;
  genre_ids?: number[];
  poster_path?: string;
  r2_poster_url?: string;
}

async function load(path: string, signal: AbortSignal) {
  const response = await fetch(apiUrl(path), { signal });
  if (!response.ok) throw new Error('Recommendations unavailable');
  return response.json();
}

export default function MovieRail({ headline, category }: { headline: string; category?: string }) {
  const topic = [category, headline].join(' ').toLowerCase();
  const sports = /sport|football|soccer|basketball|cricket|premier league|champions league|boxing|tennis|nba|ufc/.test(topic);
  const movies = useQuery({
    queryKey: ['reader', 'weekly-movies'],
    staleTime: 300_000,
    queryFn: async ({ signal }) => {
      const data = await load('/api/cinema/trending?page=1&time_window=week', signal);
      return (Array.isArray(data.results) ? data.results as Movie[] : []).filter(m => m.media_type === 'movie' && m.id && m.title);
    },
  });
  const matches = useQuery({
    queryKey: ['reader', 'live-matches'],
    enabled: sports,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => normalizeFeedMatches(await load('/api/sports/matches', signal)),
  });
  const relevance = (names: string[]) => names.filter(name => name && topic.includes(name.toLowerCase())).length;
  const live = sports ? (matches.data || []).filter(m => m.isLive && (m.directSources.length || m.exactEmbedUrl))
    .sort((a, b) => relevance([b.home, b.away, b.league]) - relevance([a.home, a.away, a.league])).slice(0, 3) : [];
  const genre = /crime|police|arrest/.test(topic) ? 80 : /tech|space|science/.test(topic) ? 878 : sports ? 99 : undefined;
  const score = (m: Movie) => relevance([m.title]) * 2 + Number(genre !== undefined && !!m.genre_ids?.includes(genre));
  const picks = [...(movies.data || [])].sort((a, b) => score(b) - score(a)).slice(0, 6);
  if (!live.length && !picks.length) return null;
  return <aside aria-label="Watch on RealSSA" className="my-8 space-y-5">
    {live.length > 0 && <section><h3 className="mb-2 font-bold">Live sport to watch</h3>
      {live.map(m => <Link key={m.id} to={`/cinema?match=${encodeURIComponent(m.id)}`} className="flex items-center justify-between gap-4 border-b border-border py-3">
        <span>{m.home} vs {m.away}</span><span className="shrink-0 text-sm font-semibold text-primary">Watch live</span>
      </Link>)}</section>}
    {picks.length > 0 && <section><h3 className="mb-3 font-bold">Movies to watch</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">{picks.map(movie => {
        const poster = movie.r2_poster_url || (movie.poster_path && 'https://image.tmdb.org/t/p/w185' + movie.poster_path);
        return <Link key={movie.id} to={`/cinema?play=${movie.id}&type=movie&title=${encodeURIComponent(movie.title)}`} className="w-28 shrink-0">
          <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">{poster && <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}</div>
          <span className="mt-1 block text-sm font-semibold">{movie.title}</span>
        </Link>;
      })}</div></section>}
  </aside>;
}
