import { apiUrl } from '@/lib/api-base';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, PlayCircle, Bell, BellOff, RefreshCw, Calendar,
  Flame, X, ChevronRight, Clock, Shield, Activity, ExternalLink, Zap
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
  match_url?: string;
  source?: string;
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
  { id: 'all',       label: 'All',      icon: '⚽' },
  { id: 'live',      label: 'Live',     icon: '🔴' },
  { id: 'upcoming',  label: 'Upcoming', icon: '📅' },
  { id: 'results',   label: 'Results',  icon: '🏁' },
];

/* ─────────────────────────── Helpers ─────────────────────────────────── */
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function competitionEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('world cup') || n.includes('fifa')) return '🌍';
  if (n.includes('champions')) return '⭐';
  if (n.includes('europa')) return '🟠';
  if (n.includes('premier') || n.includes('epl')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (n.includes('laliga') || n.includes('la liga')) return '🇪🇸';
  if (n.includes('bundesliga')) return '🇩🇪';
  if (n.includes('serie a')) return '🇮🇹';
  if (n.includes('ligue')) return '🇫🇷';
  if (n.includes('npfl') || n.includes('nigeria')) return '🇳🇬';
  if (n.includes('caf') || n.includes('africa')) return '🌍';
  if (n.includes('mls')) return '🇺🇸';
  return '🏆';
}

function groupByCompetition(matches: Match[]): Record<string, Match[]> {
  return matches.reduce((acc, m) => {
    const key = m.competition_name || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, Match[]>);
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  TeamAvatar — crest image with initials fallback                        */
/* ═══════════════════════════════════════════════════════════════════════ */
const TeamAvatar = ({ crest, name, size = 28 }: { crest: string; name: string; size?: number }) => {
  const [broken, setBroken] = useState(!crest);
  const bg = useMemo(() => {
    // Deterministic colour from team name
    const hues = [210, 240, 160, 30, 270, 340, 190, 50];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const hue = hues[Math.abs(hash) % hues.length];
    return `hsl(${hue}, 60%, 28%)`;
  }, [name]);

  if (broken || !crest) {
    return (
      <div
        style={{ width: size, height: size, background: bg, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.34, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}
      >
        {initials(name)}
      </div>
    );
  }
  return (
    <img
      src={crest} alt={name}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      onError={() => setBroken(true)}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  ScoreFlash — highlights score in gold when value changes               */
/* ═══════════════════════════════════════════════════════════════════════ */
const ScoreFlash = ({ value, live }: { value: number; live: boolean }) => {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current) {
      setFlash(true);
      prev.current = value;
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={flash ? 'score-flash' : ''}
      style={{
        fontSize: 22, fontWeight: 900,
        color: flash ? '#f59e0b' : live ? '#f87171' : '#e2e8f0',
        transition: 'color 0.3s',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  MatchCard                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */
const MatchCard = ({ match, isFollowing, onFollowToggle, onClick }: {
  match: Match; isFollowing: boolean; onFollowToggle: (id: string) => void; onClick: () => void;
}) => {
  const isLive = match.status === 'live';
  const isFin  = match.status === 'finished';
  const isSched = match.status === 'scheduled';

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer"
      style={{
        background: isLive
          ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(11,15,25,0.6) 100%)'
          : 'rgba(30,41,59,0.7)',
        border: isLive ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(51,65,85,0.6)',
        borderRadius: 14,
        transition: 'all 0.18s',
        boxShadow: isLive ? '0 0 18px rgba(239,68,68,0.12)' : 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = isLive ? 'rgba(239,68,68,0.6)' : 'rgba(234,179,8,0.5)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isLive ? 'rgba(239,68,68,0.35)' : 'rgba(51,65,85,0.6)'; (e.currentTarget as HTMLElement).style.transform = ''; }}
    >
      <div className="flex items-center px-3 py-3 gap-1">
        {/* Home team */}
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span
            style={{
              color: '#e2e8f0', maxWidth: 110, fontSize: 13, fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {match.home_team_name}
          </span>
          <TeamAvatar crest={match.home_team_crest} name={match.home_team_name} size={28} />
        </div>

        {/* Score / Time */}
        <div style={{ minWidth: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {isSched ? (
            <>
              <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 800 }}>{fmtTime(match.kickoff_at)}</span>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>{fmtDate(match.kickoff_at)}</span>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ScoreFlash value={match.home_score} live={isLive} />
                <span style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>–</span>
                <ScoreFlash value={match.away_score} live={isLive} />
              </div>
              {isLive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  <span style={{ color: '#ef4444', fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                    {match.minute && match.minute !== 'Live' ? `${match.minute}'` : 'LIVE'}
                  </span>
                </div>
              )}
              {isFin && <span style={{ color: '#475569', fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>FT</span>}
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamAvatar crest={match.away_team_crest} name={match.away_team_name} size={28} />
          <span
            style={{
              color: '#e2e8f0', maxWidth: 110, fontSize: 13, fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {match.away_team_name}
          </span>
        </div>

        {/* Follow button */}
        {match.status !== 'finished' && (
          <button
            onClick={e => { e.stopPropagation(); onFollowToggle(match.provider_match_id); }}
            style={{
              marginLeft: 6, padding: 6, borderRadius: '50%', flexShrink: 0,
              background: isFollowing ? 'rgba(234,179,8,0.15)' : 'transparent',
              color: isFollowing ? '#eab308' : '#475569',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}
            title={isFollowing ? 'Unfollow match' : 'Follow for goal alerts'}
          >
            {isFollowing ? <Bell size={13} fill="currentColor" /> : <BellOff size={13} />}
          </button>
        )}
        <ChevronRight size={12} style={{ color: '#475569', opacity: 0, flexShrink: 0, transition: 'opacity 0.15s' }}
          className="group-hover:!opacity-100" />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  CompetitionGroup                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
interface CompGroupProps {
  competition: string;
  matches: Match[];
  followedIds: string[];
  onFollowToggle: (id: string) => void;
  onMatchClick: (id: string) => void;
}
const CompetitionGroup = ({ competition, matches, followedIds, onFollowToggle, onMatchClick }: CompGroupProps) => (
  <div>
    {/* Competition header — pill badge */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 2px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
        borderRadius: 999, padding: '3px 10px 3px 8px',
      }}>
        <span style={{ fontSize: 13 }}>{competitionEmoji(competition)}</span>
        <span style={{
          fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#eab308',
        }}>
          {competition}
        </span>
      </div>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(234,179,8,0.2), transparent)' }} />
      <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>
        {matches.length} match{matches.length !== 1 ? 'es' : ''}
      </span>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

/* ═══════════════════════════════════════════════════════════════════════ */
/*  MatchModal — dual mode: API (full details) vs Scraper (scoreboard)     */
/* ═══════════════════════════════════════════════════════════════════════ */
const MatchModal = ({ matchId, match, matchDetails, h2hData, loading, onClose }: {
  matchId: string; match: Match | null; matchDetails: any; h2hData: any; loading: boolean; onClose: () => void;
}) => {
  // Scraper match: no matchDetails returned from API, but we have raw match data
  const isScraperMatch = !matchDetails && match && !loading;
  const isLive = match?.status === 'live';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden', background: '#0f1623', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(51,65,85,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{match ? competitionEmoji(match.competition_name) : '🏆'}</span>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#eab308' }}>
              {match?.competition_name || matchDetails?.competition?.name || 'Match Details'}
            </span>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'rgba(51,65,85,0.4)', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 70, borderRadius: 12, background: '#1a2234', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>

          ) : isScraperMatch ? (
            /* ── SCRAPER MODE: rich scoreboard from raw match data ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Big Scoreboard */}
              <div style={{ background: 'linear-gradient(135deg, #131b2a, #0f1623)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 16, padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
                  {/* Home */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <TeamAvatar crest={match.home_team_crest} name={match.home_team_name} size={56} />
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 700, color: '#e2e8f0', textAlign: 'center' }}>
                      {match.home_team_name}
                    </span>
                  </div>
                  {/* Score */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {match.status === 'scheduled' ? (
                      <>
                        <Clock size={22} style={{ color: '#38bdf8' }} />
                        <span style={{ color: '#38bdf8', fontSize: 15, fontWeight: 800 }}>{fmtTime(match.kickoff_at)}</span>
                        <span style={{ color: '#64748b', fontSize: 11 }}>{fmtDate(match.kickoff_at)}</span>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 38, fontWeight: 900, color: isLive ? '#f87171' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{match.home_score}</span>
                          <span style={{ color: '#475569', fontSize: 20 }}>–</span>
                          <span style={{ fontSize: 38, fontWeight: 900, color: isLive ? '#f87171' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{match.away_score}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isLive && <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />}
                          <span style={{
                            fontSize: 11, fontWeight: 800, letterSpacing: 1,
                            color: isLive ? '#ef4444' : match.status === 'finished' ? '#64748b' : '#94a3b8',
                            textTransform: 'uppercase',
                          }}>
                            {isLive
                              ? (match.minute && match.minute !== 'Live' ? `${match.minute}'` : 'LIVE')
                              : match.status === 'finished' ? 'Full Time'
                              : match.status}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Away */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <TeamAvatar crest={match.away_team_crest} name={match.away_team_name} size={56} />
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 700, color: '#e2e8f0', textAlign: 'center' }}>
                      {match.away_team_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scraper Meta */}
              <div style={{ background: '#131b2a', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', borderBottom: '1px solid rgba(51,65,85,0.4)', paddingBottom: 8 }}>Match Info</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Competition</span>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{match.competition_name}</p>
                  </div>
                  {match.kickoff_at && (
                    <div>
                      <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Kickoff</span>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{fmtDate(match.kickoff_at)} · {fmtTime(match.kickoff_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Source link */}
              {match.match_url && (
                <a
                  href={match.match_url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 12,
                    background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
                    color: '#eab308', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(234,179,8,0.18)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(234,179,8,0.1)'; }}
                >
                  <ExternalLink size={14} />
                  View Live Commentary
                </a>
              )}
            </div>

          ) : matchDetails ? (
            /* ── API MODE: full match details from football-data.org ── */
            <>
              {/* Matchup Banner */}
              <div style={{ padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, #131b2a, #0f1623)', border: '1px solid rgba(51,65,85,0.5)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
                  {/* Home */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <TeamAvatar crest={matchDetails.homeTeam?.crest} name={matchDetails.homeTeam?.name || ''} size={52} />
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, fontWeight: 700, color: '#e2e8f0', textAlign: 'center', lineHeight: 1.3 }}>
                      {matchDetails.homeTeam?.shortName || matchDetails.homeTeam?.name}
                    </span>
                  </div>
                  {/* Score */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    {(matchDetails.status === 'SCHEDULED' || matchDetails.status === 'scheduled') ? (
                      <>
                        <Clock size={20} style={{ color: '#38bdf8' }} />
                        <span style={{ color: '#38bdf8', fontSize: 14, fontWeight: 800 }}>{fmtTime(matchDetails.utcDate)}</span>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 34, fontWeight: 900, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{matchDetails.score?.fullTime?.home ?? 0}</span>
                        <span style={{ color: '#475569', fontSize: 16 }}>–</span>
                        <span style={{ fontSize: 34, fontWeight: 900, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{matchDetails.score?.fullTime?.away ?? 0}</span>
                      </div>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: 1, marginTop: 4,
                      padding: '2px 10px', borderRadius: 999,
                      background: matchDetails.status === 'IN_PLAY' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)',
                      color: matchDetails.status === 'IN_PLAY' ? '#ef4444' : '#64748b',
                    }}>
                      {matchDetails.status === 'IN_PLAY' ? '🔴 LIVE' : matchDetails.status === 'FINISHED' ? 'FT' : matchDetails.status}
                    </span>
                  </div>
                  {/* Away */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <TeamAvatar crest={matchDetails.awayTeam?.crest} name={matchDetails.awayTeam?.name || ''} size={52} />
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, fontWeight: 700, color: '#e2e8f0', textAlign: 'center', lineHeight: 1.3 }}>
                      {matchDetails.awayTeam?.shortName || matchDetails.awayTeam?.name}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 12, fontSize: 11, color: '#64748b', borderTop: '1px solid rgba(51,65,85,0.4)' }}>
                  {new Date(matchDetails.utcDate).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                </div>
              </div>

              {/* Match Info */}
              {(matchDetails.venue || matchDetails.matchday || matchDetails.referees?.length > 0) && (
                <div style={{ padding: 16, borderRadius: 14, background: '#131b2a', border: '1px solid rgba(51,65,85,0.5)', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', borderBottom: '1px solid rgba(51,65,85,0.4)', paddingBottom: 8, marginBottom: 12 }}>Match Info</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {matchDetails.venue && (
                      <div>
                        <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Venue</span>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>🏟️ {matchDetails.venue}</p>
                      </div>
                    )}
                    {matchDetails.matchday && (
                      <div>
                        <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Matchday</span>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>Round {matchDetails.matchday}</p>
                      </div>
                    )}
                    {matchDetails.referees?.length > 0 && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Referee</span>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>🟨 {matchDetails.referees.map((r: any) => r.name).join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* H2H */}
              {h2hData?.aggregates && (
                <div>
                  <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 10 }}>Head to Head</h3>
                  <div style={{ padding: 16, borderRadius: 14, background: '#131b2a', border: '1px solid rgba(51,65,85,0.5)', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                      <span style={{ color: '#22c55e' }}>{h2hData.aggregates.homeTeam?.wins ?? 0}W</span>
                      <span style={{ color: '#64748b' }}>{(h2hData.aggregates.numberOfMatches ?? 0) - (h2hData.aggregates.homeTeam?.wins ?? 0) - (h2hData.aggregates.awayTeam?.wins ?? 0)}D</span>
                      <span style={{ color: '#3b82f6' }}>{h2hData.aggregates.awayTeam?.wins ?? 0}W</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', display: 'flex', background: '#1e2d47' }}>
                      {h2hData.aggregates.numberOfMatches > 0 && (
                        <>
                          <div style={{ height: '100%', width: `${((h2hData.aggregates.homeTeam?.wins ?? 0) / h2hData.aggregates.numberOfMatches) * 100}%`, background: '#22c55e', transition: 'width 0.6s' }} />
                          <div style={{ height: '100%', width: `${(((h2hData.aggregates.numberOfMatches ?? 0) - (h2hData.aggregates.homeTeam?.wins ?? 0) - (h2hData.aggregates.awayTeam?.wins ?? 0)) / h2hData.aggregates.numberOfMatches) * 100}%`, background: '#374151' }} />
                          <div style={{ height: '100%', width: `${((h2hData.aggregates.awayTeam?.wins ?? 0) / h2hData.aggregates.numberOfMatches) * 100}%`, background: '#3b82f6' }} />
                        </>
                      )}
                    </div>
                    <p style={{ textAlign: 'center', fontSize: 10, marginTop: 8, color: '#64748b' }}>Last {h2hData.aggregates.numberOfMatches} meetings</p>
                  </div>
                  {h2hData.matches?.slice(0, 5).map((m: any) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, fontSize: 12, background: '#131b2a', border: '1px solid rgba(51,65,85,0.5)', marginBottom: 6 }}>
                      <span style={{ color: '#64748b', minWidth: 52 }}>{new Date(m.utcDate).toLocaleDateString([], { month: 'short', year: '2-digit' })}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: '#cbd5e1', textAlign: 'right', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.homeTeam?.shortName || m.homeTeam?.name}</span>
                        <span style={{ fontWeight: 900, padding: '2px 8px', borderRadius: 6, background: '#1e2d47', color: '#e2e8f0' }}>{m.score?.fullTime?.home} – {m.score?.fullTime?.away}</span>
                        <span style={{ fontWeight: 600, color: '#cbd5e1', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.awayTeam?.shortName || m.awayTeam?.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Main Page                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */
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

  /* ── Derived match lists (declared early so loadMatches can ref them) ── */
  const liveMatches      = useMemo(() => matches.filter(m => m.status === 'live'), [matches]);
  const scheduledMatches = useMemo(() => matches.filter(m => m.status === 'scheduled'), [matches]);
  const finishedMatches  = useMemo(() => matches.filter(m => m.status === 'finished'), [matches]);

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
    const iv = setInterval(loadMatches, liveMatches.length > 0 ? 15_000 : 30_000);
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
  const totalPages    = Math.ceil(gridArticles.length / SPORTS_PER_PAGE);
  const paginatedGrid = gridArticles.slice((currentPage - 1) * SPORTS_PER_PAGE, currentPage * SPORTS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    document.getElementById('sports-news-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  // The raw match object for the selected match (for scraper modal mode)
  const selectedMatch = useMemo(() => matches.find(m => m.provider_match_id === selectedMatchId) ?? null, [matches, selectedMatchId]);

  /* ────────────────────────── RENDER ──────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom, #080e1a 0%, #0f1623 60%, #111827 100%)', color: '#e2e8f0' }}>
      {/* CSS Keyframes injected inline */}
      <style>{`
        @keyframes scoreFlash {
          0%   { color: #f59e0b; text-shadow: 0 0 18px rgba(245,158,11,0.8); transform: scale(1.25); }
          60%  { color: #fbbf24; }
          100% { color: inherit;  text-shadow: none; transform: scale(1); }
        }
        .score-flash { animation: scoreFlash 1.2s ease-out forwards; }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
        .live-dot { animation: livePulse 1.2s ease-in-out infinite; }
      `}</style>

      <SEO
        title="Sports Livescore Hub | RealSSA"
        description="Live match scores, standings, upcoming fixtures from EPL, CAF, NPFL and 30+ leagues."
        keywords="Sports scores, livescores EPL, Champions League, NPFL, CAF, football tables, sports news Nigeria"
      />
      <Header />
      <NewsTicker />

      {/* ── Hero Banner ──────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #0d1117 0%, #1a0f00 40%, #1a1000 70%, #0d1117 100%)',
        borderBottom: '1px solid rgba(234,179,8,0.15)',
        position: 'relative', overflow: 'hidden',
        padding: '36px 16px',
      }}>
        {/* Gold glow orbs */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,100,8,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container mx-auto" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Icon */}
              <div style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 0 28px rgba(217,119,6,0.4)', padding: 12, borderRadius: 14, flexShrink: 0 }}>
                <Trophy size={24} style={{ color: '#fff' }} />
              </div>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 900, lineHeight: 1.1, color: '#f1f5f9' }}>
                  RealSSA <span style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sports Hub</span>
                </h1>
                <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Live scores · Goal alerts · 30+ leagues worldwide</p>
              </div>
              {/* Live count badge */}
              {liveMatches.length > 0 && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 999, padding: '5px 12px' }}>
                  <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 900 }}>{liveMatches.length} LIVE</span>
                </div>
              )}
            </div>

            {/* Watch Live + Search row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {hasLiveStreams && (
                <Link to="/videos" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                  fontWeight: 800, borderRadius: 999, fontSize: 13, textDecoration: 'none',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: 'white', boxShadow: '0 4px 18px rgba(220,38,38,0.35)', flexShrink: 0,
                }}>
                  <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
                  Watch Live <PlayCircle size={14} />
                </Link>
              )}
              <div style={{ flex: 1, minWidth: 240, maxWidth: 480 }}>
                <CategorySearch category="sports" onSearchResults={r => { setSearchResults(r as SportsArticle[]); setCurrentPage(1); }} onClearSearch={() => setSearchResults(null)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto" style={{ maxWidth: 860, padding: '20px 16px', flex: 1 }}>

        {/* ── Scores Section ─────────────────────────────────────────── */}
        <section style={{ background: '#0f1623', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.4)', marginBottom: 32 }}>

          {/* ── Pill Tab Bar ── */}
          <div style={{ borderBottom: '1px solid rgba(51,65,85,0.5)', background: '#080e1a', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', transition: 'all 0.18s',
                      background: isActive ? 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.08))' : 'transparent',
                      color: isActive ? '#eab308' : '#475569',
                      boxShadow: isActive ? 'inset 0 0 0 1px rgba(234,179,8,0.4)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{tab.icon}</span>
                    {tab.label}
                    {tab.id === 'live' && liveMatches.length > 0 && (
                      <span style={{ background: '#ef4444', color: 'white', fontSize: 9, fontWeight: 900, borderRadius: 999, padding: '1px 5px', marginLeft: 2 }}>
                        {liveMatches.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {lastRefreshed && (
                <span style={{ color: '#374151', fontSize: 10, display: 'none' }} className="sm:!inline">
                  {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={loadMatches}
                style={{ padding: 6, borderRadius: 8, background: 'transparent', color: '#475569', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                title="Refresh"
                onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
              >
                <RefreshCw size={14} className={matchesLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Match Content */}
          <div style={{ padding: 16 }}>
            {matchesLoading && matches.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ height: 64, borderRadius: 14, background: '#131b2a', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            ) : tabMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                <Calendar size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontWeight: 700, fontSize: 14 }}>
                  {activeTab === 'live'     ? 'No matches live right now'
                  : activeTab === 'upcoming' ? 'No upcoming fixtures found'
                  : activeTab === 'results'  ? 'No results available'
                  :                           'No matches found in the next 14 days'}
                </p>
                <p style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>Scores update every 30 seconds</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

        {/* ── Sports News ─────────────────────────────────────────────── */}
        <section id="sports-news-section" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 800, color: '#f1f5f9', borderBottom: '1px solid rgba(51,65,85,0.5)', paddingBottom: 10 }}>
            Latest Sports News
          </h2>
          {newsError && (
            <div style={{ textAlign: 'center', padding: '40px 20px', borderRadius: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <p style={{ fontWeight: 700, marginBottom: 12 }}>{newsError}</p>
              <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 999, fontWeight: 700, color: 'white', fontSize: 13, background: '#dc2626', border: 'none', cursor: 'pointer' }}>🔄 Retry</button>
            </div>
          )}
          {newsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 240, borderRadius: 18, background: '#0f1623', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
          ) : (
            <>
              {featuredArticle && !searchResults && (
                <div style={{ marginBottom: 4 }}>
                  <NewsCard key={featuredArticle.id} title={featuredArticle.title} excerpt={featuredArticle.excerpt} category="sports" image={featuredArticle.image} readTime={featuredArticle.readTime} date={featuredArticle.date} id={featuredArticle.id} externalLink={featuredArticle.externalLink} />
                </div>
              )}
              {paginatedGrid.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {paginatedGrid.map(a => <NewsCard key={a.id} title={a.title} excerpt={a.excerpt} category="sports" image={a.image} readTime={a.readTime} date={a.date} id={a.id} externalLink={a.externalLink} />)}
                </div>
              ) : !newsError && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>No sports articles found.</div>
              )}
              {totalPages > 1 && <div style={{ marginTop: 4 }}><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} /></div>}
            </>
          )}
        </section>
      </div>

      {/* ── Match Details Modal ─────────────────────────────────────────── */}
      {selectedMatchId && (
        <MatchModal
          matchId={selectedMatchId}
          match={selectedMatch}
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

export default Sports;
