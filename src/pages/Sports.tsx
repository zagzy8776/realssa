import { apiUrl } from '@/lib/api-base';
import { normalizeMatches, type Match } from '@/lib/sportsMatchNormalize';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, PlayCircle, Bell, BellOff, RefreshCw, Calendar,
  Flame, X, ChevronRight, Clock, Shield, Activity, Zap,
  BarChart3, CheckCircle2, Users, Award, Clapperboard, MapPin
} from 'lucide-react';
import HighlightsPanel from '../components/HighlightsPanel';
import Header from '../components/Header';
import Footer from '../components/Footer';
import NewsTicker from '@/components/NewsTicker';
import NewsCard from '../components/NewsCard';
import CategorySearch from '@/components/CategorySearch';
import Pagination from '@/components/Pagination';
import SEO from '@/components/SEO';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { Link, useNavigate } from 'react-router-dom';

// Temporary recovery stub while full page is restored from backup.
// Matches are still served by /api/sports which was fixed separately.
const Sports = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/sports/matches'));
        if (!res.ok) throw new Error('Failed to load matches');
        const data = await res.json();
        if (!cancelled) setMatches(normalizeMatches(data));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#0a0f1a' }}>
      <SEO title="Sports | RealSSA" description="Live scores and fixtures" />
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Trophy className="text-amber-400" size={22} /> Sports
        </h1>
        {loading && <p className="text-slate-400 text-sm">Loading matches…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!loading && !error && matches.length === 0 && (
          <p className="text-slate-400 text-sm">No matches right now. Pull to refresh in a moment.</p>
        )}
        <div className="space-y-2">
          {matches.map(m => (
            <div
              key={m.provider_match_id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-3"
            >
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                {m.competition_name} · {m.status}
                {m.minute ? ` · ${m.minute}` : ''}
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-100">
                <span className="font-semibold truncate">{m.home_team_name}</span>
                <span className="font-black tabular-nums text-amber-400">
                  {m.status === 'scheduled' ? 'vs' : `${m.home_score} - ${m.away_score}`}
                </span>
                <span className="font-semibold truncate text-right">{m.away_team_name}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-600 mt-6">
          Full sports UI is being restored. Match data is live from the API.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default Sports;
