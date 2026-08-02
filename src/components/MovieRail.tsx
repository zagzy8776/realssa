import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '@/lib/api-base';
import { Film, ChevronRight } from 'lucide-react';

interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  r2_poster_url?: string;
  backdrop_path?: string;
  vote_average?: number;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
}

interface Props {
  headline: string;   // Article headline used for keyword extraction
  articleId?: string;
}

/**
 * Extract genre/keyword hints from a news headline.
 * Maps topic words to TMDB search terms.
 */
function extractSearchTerms(headline: string): string {
  const lower = headline.toLowerCase();

  // Sports → sports movies
  if (/football|soccer|premier league|champions league|ballon|messi|ronaldo|nfl|nba|basketball/.test(lower)) return 'sports';
  if (/cricket|ipl|test match/.test(lower)) return 'cricket';
  if (/boxing|mma|ufc|wrestling/.test(lower)) return 'boxing fight';

  // Crime / thriller
  if (/murder|killed|shooting|bomb|terror|attack|crime|police|suspect|arrest/.test(lower)) return 'crime thriller';

  // Politics
  if (/election|president|government|senate|parliament|minister|coup|protest/.test(lower)) return 'political';

  // Tech
  if (/artificial intelligence|ai|chatgpt|tech|silicon valley|startup|elon musk/.test(lower)) return 'technology';

  // Nature / disaster
  if (/earthquake|flood|hurricane|volcano|tsunami|wildfire|disaster/.test(lower)) return 'disaster';

  // War / conflict
  if (/war|military|army|nato|ukraine|russia|israel|gaza|conflict/.test(lower)) return 'war';

  // Health / virus
  if (/covid|pandemic|virus|disease|health|hospital|vaccine/.test(lower)) return 'pandemic virus';

  // Finance / economy
  if (/economy|naira|dollar|stock|crypto|bitcoin|bank|inflation/.test(lower)) return 'money';

  // Default: trending popular
  return 'popular';
}

const IMG_BASE = 'https://image.tmdb.org/t/p/w342';

const MovieRail = ({ headline, articleId }: Props) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const term = extractSearchTerms(headline);
    const key = `cinema_rail:${term}`;

    // Check sessionStorage cache to avoid redundant API calls
    const cached = sessionStorage.getItem(key);
    if (cached) {
      try {
        setMovies(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (_) {}
    }

    fetch(apiUrl(`/api/cinema/search?q=${encodeURIComponent(term)}&type=multi`))
      .then(r => r.json())
      .then(data => {
        const results = (data.results || [])
          .filter((m: Movie) => m.poster_path || m.r2_poster_url)
          .slice(0, 8);
        setMovies(results);
        sessionStorage.setItem(key, JSON.stringify(results));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [headline]);

  if (loading || movies.length === 0) return null;

  const searchTerm = extractSearchTerms(headline);
  const label = searchTerm === 'popular' ? '🔥 Trending Movies' : `🎬 Watch: ${searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)} Films`;

  return (
    <div className="mt-10 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
        </div>
        <button
          onClick={() => navigate('/videos')}
          className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 font-semibold transition-colors"
        >
          Watch Free <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
        {movies.map(movie => {
          const poster = movie.r2_poster_url || (movie.poster_path ? `${IMG_BASE}${movie.poster_path}` : null);
          const title = movie.title || movie.name || '';
          const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
          const rating = (movie.vote_average ?? 0).toFixed(1);

          return (
            <button
              key={movie.id}
              onClick={() => navigate('/videos')}
              className="flex-shrink-0 snap-start w-28 group"
            >
              <div className="relative w-28 h-40 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 group-hover:border-amber-500/50 transition-all duration-200 group-hover:scale-105">
                {poster ? (
                  <img
                    src={poster}
                    alt={title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-8 h-8 text-zinc-600" />
                  </div>
                )}
                {/* Rating badge */}
                {parseFloat(rating) > 0 && (
                  <div className="absolute top-1.5 right-1.5 bg-black/70 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    ⭐{rating}
                  </div>
                )}
                {/* Play overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1.5 text-left truncate px-0.5">{title}</p>
              {year && <p className="text-[9px] text-zinc-600 px-0.5">{year}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MovieRail;
