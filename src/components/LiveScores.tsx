import { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Clock, X, ChevronDown, ChevronUp, AlertCircle, ExternalLink, Newspaper } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';

interface Match {
  match_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: 'live' | 'scheduled' | 'finished';
  match_minute: string | null;
  kickoff_at: string;
  updated_at: string;
  home_hype_count?: number;
  away_hype_count?: number;
}

const COMPETITION_FLAGS: Record<string, string> = {
  'premier league': '🏴', 'championship': '🏴', 'la liga': '🇪🇸',
  'bundesliga': '🇩🇪', 'serie a': '🇮🇹', 'ligue 1': '🇫🇷',
  'champions league': '⭐', 'europa league': '🟠', 'world cup': '🌍',
  'npfl': '🇳🇬', 'nigeria': '🇳🇬', 'caf': '🌍', 'afcon': '🌍',
  'eredivisie': '🇳🇱', 'primeira liga': '🇵🇹',
};

function getFlag(competition: string) {
  const lower = competition.toLowerCase();
  for (const [key, flag] of Object.entries(COMPETITION_FLAGS)) {
    if (lower.includes(key)) return flag;
  }
  return '⚽';
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return '--:--'; }
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

const MatchDetailModal = ({ match, onClose }: { match: Match; onClose: () => void }) => {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const flag = getFlag(match.competition);

  const handleViewNews = () => {
    const q = `${match.home_team} vs ${match.away_team} ${match.competition}`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws`, '_blank');
  };

  const handleHighlights = () => {
    const q = `${match.home_team} vs ${match.away_team} highlights`;
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 420, background: '#0f1623', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{flag}</span>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#eab308' }}>
              {match.competition}
            </span>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'rgba(51,65,85,0.4)', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Scoreboard */}
        <div style={{ padding: '24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 18, fontWeight: 900, color: '#93c5fd' }}>
                {match.home_team.slice(0, 2).toUpperCase()}
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{match.home_team}</p>
            </div>

            <div style={{ textAlign: 'center', minWidth: 80 }}>
              {match.status === 'scheduled' ? (
                <>
                  <Clock size={20} style={{ color: '#38bdf8', margin: '0 auto 4px' }} />
                  <p style={{ color: '#38bdf8', fontSize: 16, fontWeight: 900 }}>{fmtTime(match.kickoff_at)}</p>
                  <p style={{ color: '#64748b', fontSize: 11 }}>{fmtDate(match.kickoff_at)}</p>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                    <span style={{ fontSize: 40, fontWeight: 900, color: isLive ? '#f87171' : '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{match.home_score}</span>
                    <span style={{ color: '#334155', fontSize: 20 }}>:</span>
                    <span style={{ fontSize: 40, fontWeight: 900, color: isLive ? '#f87171' : '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{match.away_score}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6, padding: '3px 10px', borderRadius: 999, background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.12)', border: isLive ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(51,65,85,0.4)', display: 'inline-flex' }}>
                    {isLive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} />}
                    <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: isLive ? '#ef4444' : '#64748b' }}>
                      {isLive ? (match.match_minute ? `${match.match_minute}'` : 'LIVE') : 'FT'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 18, fontWeight: 900, color: '#fdba74' }}>
                {match.away_team.slice(0, 2).toUpperCase()}
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{match.away_team}</p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={handleViewNews}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(51,65,85,0.4)', border: '1px solid rgba(51,65,85,0.6)', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Newspaper size={15} /> News
            </button>
            <button
              onClick={handleHighlights}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <ExternalLink size={15} /> Highlights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MatchCard = ({ match, onClick }: { match: Match; onClick: () => void }) => {
  const isLive = match.status === 'live';
  const isScheduled = match.status === 'scheduled';
  const flag = getFlag(match.competition);

  return (
    <div
      onClick={onClick}
      style={{
        background: isLive ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(15,22,35,0.6))' : 'rgba(30,41,59,0.7)',
        border: isLive ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(51,65,85,0.6)',
        borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: isLive ? '0 0 16px rgba(239,68,68,0.1)' : 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = isLive ? 'rgba(239,68,68,0.6)' : 'rgba(234,179,8,0.4)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isLive ? 'rgba(239,68,68,0.35)' : 'rgba(51,65,85,0.6)'; }}
    >
      {/* Competition row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{flag}</span> {match.competition}
        </span>
        {isLive && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 900, color: '#ef4444', letterSpacing: 1 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            {match.match_minute ? `${match.match_minute}'` : 'LIVE'}
          </span>
        )}
        {isScheduled && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8' }}>{fmtTime(match.kickoff_at)}</span>
        )}
        {match.status === 'finished' && (
          <span style={{ fontSize: 9, fontWeight: 800, color: '#475569', letterSpacing: 1 }}>FT</span>
        )}
      </div>

      {/* Teams + Score */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {match.home_team}
        </span>
        <div style={{ textAlign: 'center', minWidth: 60 }}>
          {isScheduled ? (
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{fmtDate(match.kickoff_at)}</span>
          ) : (
            <span style={{ fontSize: 20, fontWeight: 900, color: isLive ? '#f87171' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
              {match.home_score} – {match.away_score}
            </span>
          )}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {match.away_team}
        </span>
      </div>
    </div>
  );
};

const LiveScores = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'results'>('live');
  const [showAll, setShowAll] = useState(false);

  const fetchScores = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(apiUrl('/api/sports/live'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Match[] = await res.json();
      setMatches(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load scores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 30000);
    return () => clearInterval(interval);
  }, []);

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'scheduled');
  const resultMatches = matches.filter(m => m.status === 'finished');

  const tabMatches = activeTab === 'live' ? liveMatches : activeTab === 'upcoming' ? upcomingMatches : resultMatches;
  const displayed = showAll ? tabMatches : tabMatches.slice(0, 6);

  const TABS = [
    { id: 'live' as const, label: 'Live', count: liveMatches.length, color: '#ef4444' },
    { id: 'upcoming' as const, label: 'Upcoming', count: upcomingMatches.length, color: '#38bdf8' },
    { id: 'results' as const, label: 'Results', count: resultMatches.length, color: '#64748b' },
  ];

  if (loading) {
    return (
      <div style={{ background: '#0f1623', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 18, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 64, borderRadius: 12, background: '#131b2a', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error && matches.length === 0) {
    return (
      <div style={{ background: '#0f1623', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 18, padding: 24, marginBottom: 24, textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
        <p style={{ color: '#ef4444', fontWeight: 700, marginBottom: 12 }}>{error}</p>
        <button onClick={fetchScores} style={{ padding: '8px 20px', borderRadius: 999, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
      `}</style>

      <div style={{ background: '#0f1623', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 18, overflow: 'hidden', marginBottom: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(51,65,85,0.5)', background: '#080e1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={16} style={{ color: '#eab308' }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>Live Scores</span>
            {liveMatches.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 900, color: '#ef4444' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} />
                {liveMatches.length} LIVE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastUpdated && <span style={{ fontSize: 10, color: '#374151' }}>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={fetchScores} style={{ padding: 6, borderRadius: 8, background: 'transparent', color: '#475569', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowAll(false); }}
              style={{
                padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                background: activeTab === tab.id ? 'rgba(234,179,8,0.12)' : 'transparent',
                color: activeTab === tab.id ? '#eab308' : '#475569',
                boxShadow: activeTab === tab.id ? 'inset 0 0 0 1px rgba(234,179,8,0.35)' : 'none',
              }}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Matches */}
        <div style={{ padding: 12 }}>
          {tabMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>
                {activeTab === 'live' ? 'No live matches right now' : activeTab === 'upcoming' ? 'No upcoming fixtures' : 'No results available'}
              </p>
              <p style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>Updates every 30 seconds</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {displayed.map(match => (
                  <MatchCard key={match.match_id} match={match} onClick={() => setSelectedMatch(match)} />
                ))}
              </div>
              {tabMatches.length > 6 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  style={{ width: '100%', marginTop: 10, padding: '8px', borderRadius: 10, background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.5)', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showAll ? 'Show Less' : `View All ${tabMatches.length} Matches`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(51,65,85,0.4)', textAlign: 'center' }}>
          <a href="/sports" style={{ fontSize: 12, color: '#eab308', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Full Sports Hub <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {selectedMatch && <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />}
    </>
  );
};

export default LiveScores;
