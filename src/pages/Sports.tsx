import { apiUrl } from '@/lib/api-base';
import { useState, useEffect, useMemo } from 'react';
import {
  Trophy, PlayCircle, Bell, BellOff, RefreshCw, Calendar,
  Flame, X, ChevronRight, Clock, Shield, Activity
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import NewsTicker from '@/components/NewsTicker';
import NewsCard from '../components/NewsCard';
import CategorySearch from '@/components/CategorySearch';
import Pagination from '@/components/Pagination';
import SEO from '@/components/SEO';
import SportsLeagueTables from '@/components/SportsLeagueTables';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { Link } from 'react-router-dom';

/* ─────────────────────────── Types ───────────────────────────────────── */
interface Match {
  provider_match_id: string;
  competition_name: string;
  home_team_name: string;
  home_team_crest: string;
  away_team_name: string;
  away_team_crest: string;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled';
  minute: string;
  home_score: number;
  away_score: number;
  kickoff_at: string;
  updated_at: string;
}

interface SportsArticle {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  author: string;
  date: string;
  externalLink: string;
}

/* ─────────────────────────── Constants ───────────────────────────────── */
const SPORTS_PER_PAGE = 8;

const TABS = [
  { id: 'all',       label: 'All Matches', icon: '⚽' },
  { id: 'live',      label: 'Live Now',    icon: '🔴' },
  { id: 'upcoming',  label: 'Upcoming',    icon: '📅' },
  { id: 'results',   label: 'Results',     icon: '🏁' },
  { id: 'standings', label: 'Standings',   icon: '📊' },
];

/* ─────────────────────────── Helpers ─────────────────────────────────── */
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return '--:--'; }
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function groupByCompetition(matches: Match[]): Record<string, Match[]> {
  return matches.reduce((acc, m) => {
    const key = m.competition_name || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, Match[]>);
}

/* ─────────────────────────── Main Page ───────────────────────────────── */
const Sports = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [allArticles, setAllArticles]           = useState<SportsArticle[]>([]);
  const [featuredArticle, setFeaturedArticle]   = useState<SportsArticle | null>(null);
  const [newsLoading, setNewsLoading]           = useState(true);
  const [newsError, setNewsError]               = useState<string | null>(null);
  const [searchResults, setSearchResults]       = useState<SportsArticle[] | null>(null);
  const [currentPage, setCurrentPage]           = useState(1);
  const [hasLiveStreams, setHasLiveStreams]      = useState(false);

  const [matches, setMatches]               = useState<Match[]>([]);
  const [followedIds, setFollowedIds]       = useState<string[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [deviceId, setDeviceId]             = useState<string>('');
  const [lastRefreshed, setLastRefreshed]   = useState<Date | null>(null);

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading]   = useState(false);
  const [matchDetails, setMatchDetails]       = useState<any | null>(null);
  const [h2hData, setH2hData]                 = useState<any | null>(null);

  /* ── Device ID ── */
  useEffect(() => {
    let id = localStorage.getItem('realssa_device_uuid');
    if (!id) { id = 'dev-' + Math.random().toString(36).substr(2, 9); localStorage.setItem('realssa_device_uuid', id); }
    setDeviceId(id);
  }, []);

  /* ── Match Details ── */
  useEffect(() => {
    if (!selectedMatchId) { setMatchDetails(null); setH2hData(null); return; }
    setDetailsLoading(true);
    fetch(apiUrl(`/api/sports/matches/${selectedMatchId}/details`))
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setMatchDetails(d.match); setH2hData(d.h2h); } })
      .catch(console.error)
      .finally(() => setDetailsLoading(false));
  }, [selectedMatchId]);

  /* ── Matches ── */
  const loadMatches = async () => {
    if (!deviceId) return;
    try {
      const [mRes, fRes] = await Promise.all([
        fetch(apiUrl('/api/sports/matches')),
        fetch(apiUrl(`/api/sports/following/${deviceId}`))
      ]);
      if (mRes.ok) { const d = await mRes.json(); setMatches(d.matches || []); }
      if (fRes.ok) { const d = await fRes.json(); setFollowedIds(d.following || []); }
      setLastRefreshed(new Date());
    } catch (e) { console.error(e); }
    finally { setMatchesLoading(false); }
  };

  useEffect(() => {
    if (!deviceId) return;
    loadMatches();
    // Poll every 15s when live matches exist, 30s otherwise
    const iv = setInterval(async () => {
      await loadMatches();
    }, liveMatches.length > 0 ? 15_000 : 30_000);
    return () => clearInterval(iv);
  }, [deviceId, liveMatches.length]);

  /* ── Sports News ── */
  useEffect(() => {
    const load = async () => {
      setNewsLoading(true);
      try {
        const [nRes, fRes] = await Promise.all([
          fetchWithRetry(apiUrl('/api/news/sports')),
          fetchWithRetry(apiUrl('/api/news/sports/featured')),
        ]);
        if (nRes) { const d: SportsArticle[] = await nRes.json(); setAllArticles(Array.isArray(d) ? d : []); }
        else setNewsError('Could not load sports news.');
        if (fRes) { const f = await fRes.json(); setFeaturedArticle(f || null); }
      } catch { setNewsError('Network error while fetching sports news.'); }
      finally { setNewsLoading(false); }
    };
    load();
  }, []);

  /* ── Live Streams ── */
  useEffect(() => {
    fetchWithRetry(apiUrl('/api/streams/live'))
      .then(async r => { if (r?.ok) { const d = await r.json(); setHasLiveStreams(d.length > 0); } })
      .catch(() => {});
  }, []);

  /* ── Follow toggle ── */
  const handleFollowToggle = async (matchId: string) => {
    const isFollowing = followedIds.includes(matchId);
    const action = isFollowing ? 'unfollow' : 'follow';
    setFollowedIds(prev => isFollowing ? prev.filter(id => id !== matchId) : [...prev, matchId]);
    try {
      const res = await fetch(apiUrl('/api/sports/follow'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, provider_match_id: matchId, action })
      });
      if (!res.ok) setFollowedIds(prev => isFollowing ? [...prev, matchId] : prev.filter(id => id !== matchId));
    } catch {
      setFollowedIds(prev => isFollowing ? [...prev, matchId] : prev.filter(id => id !== matchId));
    }
  };

  /* ── Derived match lists ── */
  const liveMatches      = useMemo(() => matches.filter(m => m.status === 'live'), [matches]);
  const scheduledMatches = useMemo(() => matches.filter(m => m.status === 'scheduled'), [matches]);
  const finishedMatches  = useMemo(() => matches.filter(m => m.status === 'finished'), [matches]);

  const tabMatches = useMemo(() => {
    if (activeTab === 'live')     return liveMatches;
    if (activeTab === 'upcoming') return scheduledMatches;
    if (activeTab === 'results')  return finishedMatches;
    return matches;
  }, [activeTab, matches, liveMatches, scheduledMatches, finishedMatches]);

  const groupedTabMatches = useMemo(() => groupByCompetition(tabMatches), [tabMatches]);

  /* ── News pagination ── */
  const displayArticles = searchResults ?? allArticles;
  const gridArticles    = displayArticles.filter(a =>
    a.id !== featuredArticle?.id &&
    a.title.trim().toLowerCase() !== featuredArticle?.title?.trim().toLowerCase()
  );
  const totalPages   = Math.ceil(gridArticles.length / SPORTS_PER_PAGE);
  const paginatedGrid = gridArticles.slice((currentPage - 1) * SPORTS_PER_PAGE, currentPage * SPORTS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    document.getElementById('sports-news-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ────────────────────────── RENDER ──────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col animate-in fade-in duration-300" style={{ background: 'linear-gradient(to bottom, #0b0f19 0%, #1e293b 100%)', color: '#e2e8f0' }}>
      <SEO
        title="Sports Livescore Hub | RealSSA"
        description="Live match scores, standings, upcoming fixtures from EPL, CAF, NPFL and 30+ leagues."
        keywords="Sports scores, livescores EPL, Champions League, NPFL, CAF, football tables, sports news Nigeria"
      />
      <Header />
      <NewsTicker />

      {/* ── Hero Banner ──────────────────────────────────────────────── */}
      <section style={{
        backgroundImage: 'linear-gradient(to bottom, rgba(11, 15, 25, 0.45) 0%, rgba(11, 15, 25, 0.95) 100%), url("/sports_stadium_bg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: '1px solid #1e293b'
      }} className="py-12 px-4 relative">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div style={{ background: 'linear-gradient(135deg, #1a56db, #00b4d8)', boxShadow: '0 0 24px rgba(26,86,219,0.4)' }} className="p-3 rounded-xl">
                <Trophy size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: '#e2e8f0' }}>
                  RealSSA <span style={{ color: '#00b4d8' }}>Sports Hub</span>
                  {liveMatches.length > 0 && (
                    <span className="ml-3 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full align-middle" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      {liveMatches.length} LIVE
                    </span>
                  )}
                </h1>
                <p style={{ color: '#94a3b8' }} className="text-sm mt-0.5">Live scores · Goal alerts · 30+ leagues worldwide</p>
              </div>
            </div>
            {hasLiveStreams && (
              <Link to="/videos" className="sm:ml-auto inline-flex items-center gap-2 px-4 py-2.5 font-bold rounded-full transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', boxShadow: '0 4px 16px rgba(220,38,38,0.3)' }}>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Watch Live <PlayCircle size={16} />
              </Link>
            )}
          </div>
          <div className="max-w-xl">
            <CategorySearch category="sports" onSearchResults={r => { setSearchResults(r as SportsArticle[]); setCurrentPage(1); }} onClearSearch={() => setSearchResults(null)} />
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-4xl px-4 py-6 flex-1 space-y-6">

        {/* ── Main Column ──────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Scores Section */}
          <section style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16 }} className="overflow-hidden shadow-xl">

            {/* Tab Bar */}
            <div style={{ borderBottom: '1px solid #334155', background: '#131b2e' }} className="flex items-center justify-between px-4 pt-3 gap-2">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 pb-1">
                {TABS.map(tab => {
                  if (tab.id === 'standings') return null; // standings in sidebar
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap transition-all rounded-t-lg relative"
                      style={isActive ? { color: '#00b4d8', borderBottom: '2px solid #00b4d8', background: 'rgba(0,180,216,0.08)' } : { color: '#64748b' }}
                    >
                      <span>{tab.icon}</span>
                      {tab.label}
                      {tab.id === 'live' && liveMatches.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black rounded-full" style={{ background: '#ef4444', color: 'white' }}>
                          {liveMatches.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pb-2 flex-shrink-0 pl-2">
                {lastRefreshed && (
                  <span className="hidden sm:inline text-slate-500 text-[10px]">
                    Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button onClick={loadMatches} className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-slate-300 hover:bg-slate-800" title="Refresh">
                  <RefreshCw size={14} className={matchesLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Match Content */}
            <div className="p-4">
              {matchesLoading && matches.length === 0 ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#1a2234' }} />
                  ))}
                </div>
              ) : tabMatches.length === 0 ? (
                <div className="text-center py-12" style={{ color: '#94a3b8' }}>
                  <Calendar size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">
                    {activeTab === 'live' ? 'No matches live right now' :
                     activeTab === 'upcoming' ? 'No upcoming fixtures found' :
                     activeTab === 'results' ? 'No results available' :
                     'No matches found in the next 14 days'}
                  </p>
                  <p className="text-xs mt-1 opacity-60">Check back soon — scores update every 30 seconds</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(groupedTabMatches).map(([comp, compMatches]) => (
                    <CompetitionGroup
                      key={comp}
                      competition={comp}
                      matches={compMatches}
                      followedIds={followedIds}
                      onFollowToggle={handleFollowToggle}
                      onMatchClick={id => setSelectedMatchId(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Sports News */}
          <section id="sports-news-section" className="space-y-5">
            <h2 className="text-xl font-bold" style={{ color: '#e2e8f0', borderBottom: '1px solid #1e2d47', paddingBottom: 8 }}>
              Latest Sports News
            </h2>
            {newsError && (
              <div className="text-center py-10 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                <p className="font-bold mb-3">{newsError}</p>
                <button onClick={() => window.location.reload()} className="px-5 py-2 rounded-full font-semibold text-white text-sm" style={{ background: '#dc2626' }}>🔄 Retry</button>
              </div>
            )}
            {newsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: '#111827' }} />)}
              </div>
            ) : (
              <>
                {featuredArticle && !searchResults && (
                  <div className="mb-5">
                    <NewsCard key={featuredArticle.id} title={featuredArticle.title} excerpt={featuredArticle.excerpt} category="sports" image={featuredArticle.image} readTime={featuredArticle.readTime} date={featuredArticle.date} id={featuredArticle.id} externalLink={featuredArticle.externalLink} />
                  </div>
                )}
                {paginatedGrid.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {paginatedGrid.map(a => <NewsCard key={a.id} title={a.title} excerpt={a.excerpt} category="sports" image={a.image} readTime={a.readTime} date={a.date} id={a.id} externalLink={a.externalLink} />)}
                  </div>
                ) : (!newsError && <div className="text-center py-10" style={{ color: '#94a3b8' }}>No sports articles found.</div>)}
                {totalPages > 1 && <div className="mt-5"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} /></div>}
              </>
            )}
          </section>
        </div>
      </div>

      {/* ── Match Details Modal ─────────────────────────────────────────── */}
      {selectedMatchId && (
        <MatchModal
          matchId={selectedMatchId}
          matchDetails={matchDetails}
          h2hData={h2hData}
          loading={detailsLoading}
          onClose={() => setSelectedMatchId(null)}
        />
      )}

      <Footer />
    </div>
  );
};

/* ─────────────────────────── CompetitionGroup ────────────────────────── */
interface CompGroupProps {
  competition: string;
  matches: Match[];
  followedIds: string[];
  onFollowToggle: (id: string) => void;
  onMatchClick: (id: string) => void;
}
const CompetitionGroup = ({ competition, matches, followedIds, onFollowToggle, onMatchClick }: CompGroupProps) => (
  <div>
    <div className="flex items-center gap-2 mb-2 px-1">
      <Shield size={13} style={{ color: '#00b4d8' }} />
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00b4d8' }}>{competition}</span>
      <div className="flex-1 h-px" style={{ background: '#334155' }} />
      <span className="text-[10px]" style={{ color: '#64748b' }}>{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
    </div>
    <div className="space-y-1.5">
      {matches.map(m => (
        <MatchCard
          key={m.provider_match_id}
          match={m}
          isFollowing={followedIds.includes(m.provider_match_id)}
          onFollowToggle={onFollowToggle}
          onClick={() => onMatchClick(m.provider_match_id)}
        />
      ))}
    </div>
  </div>
);

/* ─────────────────────────── MatchCard ───────────────────────────────── */
const MatchCard = ({ match, isFollowing, onFollowToggle, onClick }: {
  match: Match; isFollowing: boolean; onFollowToggle: (id: string) => void; onClick: () => void;
}) => {
  const isLive = match.status === 'live';
  const isFin  = match.status === 'finished';

  return (
    <div
      style={{
        background: isLive ? 'rgba(239,68,68,0.1)' : '#1e293b',
        border: isLive ? '1px solid rgba(239,68,68,0.3)' : '1px solid #334155',
        borderRadius: 12,
        transition: 'all 0.15s'
      }}
      className="flex items-center px-3 py-2.5 group hover:border-blue-500/50 cursor-pointer shadow-sm hover:shadow"
      onClick={onClick}
    >
      {/* Home team */}
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <span className="text-xs sm:text-sm font-semibold truncate text-right" style={{ color: '#e2e8f0', maxWidth: 120 }}>{match.home_team_name}</span>
        {match.home_team_crest
          ? <img src={match.home_team_crest} alt="" className="w-6 h-6 object-contain flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: '#334155' }} />
        }
      </div>

      {/* Score / Time */}
      <div className="flex flex-col items-center justify-center mx-3 min-w-[60px]">
        {match.status === 'scheduled' ? (
          <>
            <span className="text-xs font-bold" style={{ color: '#00b4d8' }}>{fmtTime(match.kickoff_at)}</span>
            <span className="text-[10px]" style={{ color: '#64748b' }}>{fmtDate(match.kickoff_at)}</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black" style={{ color: isLive ? '#ef4444' : '#e2e8f0' }}>{match.home_score}</span>
              <span style={{ color: '#64748b', fontSize: 11 }}>–</span>
              <span className="text-base font-black" style={{ color: isLive ? '#ef4444' : '#e2e8f0' }}>{match.away_score}</span>
            </div>
            {isLive && (
              <span className="text-[9px] font-black uppercase animate-pulse" style={{ color: '#ef4444', letterSpacing: 1 }}>
                {match.minute && match.minute !== 'Live' ? `${match.minute}'` : 'LIVE'}
              </span>
            )}
            {isFin  && <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>FT</span>}
          </>
        )}
      </div>

      {/* Away team */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {match.away_team_crest
          ? <img src={match.away_team_crest} alt="" className="w-6 h-6 object-contain flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: '#334155' }} />
        }
        <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: '#e2e8f0', maxWidth: 120 }}>{match.away_team_name}</span>
      </div>

      {/* Follow button */}
      {match.status !== 'finished' && (
        <button
          onClick={e => { e.stopPropagation(); onFollowToggle(match.provider_match_id); }}
          className="ml-3 p-1.5 rounded-full flex-shrink-0 transition-all hover:bg-slate-700"
          style={isFollowing ? { background: 'rgba(0,180,216,0.15)', color: '#00b4d8' } : { color: '#64748b' }}
          title={isFollowing ? 'Unfollow match' : 'Follow for goal alerts'}
        >
          {isFollowing ? <Bell size={14} fill="currentColor" /> : <BellOff size={14} />}
        </button>
      )}
      <ChevronRight size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: '#64748b' }} />
    </div>
  );
};

/* ─────────────────────────── MatchModal ──────────────────────────────── */
const MatchModal = ({ matchId, matchDetails, h2hData, loading, onClose }: {
  matchId: string; matchDetails: any; h2hData: any; loading: boolean; onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
    <div className="w-full max-w-lg flex flex-col max-h-[88vh] overflow-hidden" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>

      {/* Modal Header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #334155' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00b4d8' }}>
          {matchDetails?.competition?.name || 'Match Details'}
        </span>
        <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-slate-700" style={{ color: '#94a3b8' }} title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Modal Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#1a2234' }} />)}
          </div>
        ) : !matchDetails ? (
          <div className="text-center py-14" style={{ color: '#94a3b8' }}>
            <Activity size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">Match details unavailable</p>
            <p className="text-xs mt-1 opacity-60">Click any FD.org match for full stats & H2H</p>
          </div>
        ) : (
          <>
            {/* Matchup Banner */}
            <div className="p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg, #0f1623, #131b2a)', border: '1px solid #1e2d47' }}>
              <div className="grid grid-cols-7 items-center gap-2">
                {/* Home */}
                <div className="col-span-3 flex flex-col items-center text-center">
                  <img src={matchDetails.homeTeam?.crest} alt="" className="w-14 h-14 object-contain mb-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="text-sm font-bold leading-tight" style={{ color: '#e2e8f0' }}>{matchDetails.homeTeam?.shortName || matchDetails.homeTeam?.name}</span>
                </div>
                {/* Score */}
                <div className="col-span-1 flex flex-col items-center">
                  {matchDetails.status === 'SCHEDULED' || matchDetails.status === 'scheduled' ? (
                    <div className="flex flex-col items-center gap-1">
                      <Clock size={18} style={{ color: '#00b4d8' }} />
                      <span className="text-xs font-bold" style={{ color: '#00b4d8' }}>{fmtTime(matchDetails.utcDate)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-2xl font-black" style={{ color: '#e2e8f0' }}>
                      <span>{matchDetails.score?.fullTime?.home ?? 0}</span>
                      <span style={{ color: '#94a3b8', fontSize: 14 }}>–</span>
                      <span>{matchDetails.score?.fullTime?.away ?? 0}</span>
                    </div>
                  )}
                  <span className="text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-full" style={{
                    background: matchDetails.status === 'IN_PLAY' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)',
                    color: matchDetails.status === 'IN_PLAY' ? '#ef4444' : '#64748b'
                  }}>
                    {matchDetails.status === 'IN_PLAY' ? '🔴 LIVE' : matchDetails.status === 'FINISHED' ? 'FT' : matchDetails.status}
                  </span>
                </div>
                {/* Away */}
                <div className="col-span-3 flex flex-col items-center text-center">
                  <img src={matchDetails.awayTeam?.crest} alt="" className="w-14 h-14 object-contain mb-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="text-sm font-bold leading-tight" style={{ color: '#e2e8f0' }}>{matchDetails.awayTeam?.shortName || matchDetails.awayTeam?.name}</span>
                </div>
              </div>
              {/* Date/Time */}
              <div className="text-center mt-4 pt-3 text-xs" style={{ borderTop: '1px solid #1e2d47', color: '#94a3b8' }}>
                {new Date(matchDetails.utcDate).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
              </div>
            </div>

            {/* Match Info */}
            <div className="p-4 rounded-2xl" style={{ background: '#131b2a', border: '1px solid #1e2d47' }}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94a3b8', borderBottom: '1px solid #1e2d47', paddingBottom: 8 }}>Match Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {matchDetails.venue && (
                  <div>
                    <span className="text-[10px] uppercase" style={{ color: '#94a3b8' }}>Venue</span>
                    <p className="font-semibold mt-0.5" style={{ color: '#e2e8f0' }}>🏟️ {matchDetails.venue}</p>
                  </div>
                )}
                {matchDetails.matchday && (
                  <div>
                    <span className="text-[10px] uppercase" style={{ color: '#94a3b8' }}>Matchday</span>
                    <p className="font-semibold mt-0.5" style={{ color: '#e2e8f0' }}>Round {matchDetails.matchday}</p>
                  </div>
                )}
                {matchDetails.referees?.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase" style={{ color: '#94a3b8' }}>Referee</span>
                    <p className="font-semibold mt-0.5" style={{ color: '#e2e8f0' }}>🟨 {matchDetails.referees.map((r: any) => r.name).join(', ')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* H2H */}
            {h2hData?.aggregates && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Head to Head</h3>
                <div className="p-4 rounded-2xl" style={{ background: '#131b2a', border: '1px solid #1e2d47' }}>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span style={{ color: '#22c55e' }}>{h2hData.aggregates.homeTeam?.wins ?? 0}W</span>
                    <span style={{ color: '#64748b' }}>{(h2hData.aggregates.numberOfMatches ?? 0) - (h2hData.aggregates.homeTeam?.wins ?? 0) - (h2hData.aggregates.awayTeam?.wins ?? 0)}D</span>
                    <span style={{ color: '#3b82f6' }}>{h2hData.aggregates.awayTeam?.wins ?? 0}W</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full overflow-hidden flex" style={{ background: '#1e2d47' }}>
                    {h2hData.aggregates.numberOfMatches > 0 && (<>
                      <div className="h-full transition-all" style={{ width: `${((h2hData.aggregates.homeTeam?.wins ?? 0) / h2hData.aggregates.numberOfMatches) * 100}%`, background: '#22c55e' }} />
                      <div className="h-full transition-all" style={{ width: `${(((h2hData.aggregates.numberOfMatches ?? 0) - (h2hData.aggregates.homeTeam?.wins ?? 0) - (h2hData.aggregates.awayTeam?.wins ?? 0)) / h2hData.aggregates.numberOfMatches) * 100}%`, background: '#374151' }} />
                      <div className="h-full transition-all" style={{ width: `${((h2hData.aggregates.awayTeam?.wins ?? 0) / h2hData.aggregates.numberOfMatches) * 100}%`, background: '#3b82f6' }} />
                    </>)}
                  </div>
                  <p className="text-center text-[10px] mt-2" style={{ color: '#94a3b8' }}>Last {h2hData.aggregates.numberOfMatches} meetings</p>
                </div>
                {h2hData.matches?.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs" style={{ background: '#131b2a', border: '1px solid #1e2d47' }}>
                    <span style={{ color: '#94a3b8', minWidth: 60 }}>{new Date(m.utcDate).toLocaleDateString([], { month: 'short', year: '2-digit' })}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-right" style={{ color: '#cbd5e1', maxWidth: 80 }} >{m.homeTeam?.shortName || m.homeTeam?.name}</span>
                      <span className="font-black px-2 py-0.5 rounded" style={{ background: '#1e2d47', color: '#e2e8f0' }}>{m.score?.fullTime?.home} – {m.score?.fullTime?.away}</span>
                      <span className="font-semibold" style={{ color: '#cbd5e1', maxWidth: 80 }}>{m.awayTeam?.shortName || m.awayTeam?.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
);

export default Sports;
