import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, RefreshCw, ArrowLeft, ArrowRight, ShieldAlert, Award, Vote } from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '@/lib/api-base';
import Header from '@/components/Header';
import { useToast } from "@/hooks/use-toast";

interface TeamRow {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

interface Match {
  match_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  match_minute: number;
  home_hype_count?: number;
  away_hype_count?: number;
  kickoff_at?: string;
}

const LEAGUE_NAMES: Record<string, { name: string; flag: string; country: string }> = {
  epl: { name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'England' },
  laliga: { name: 'La Liga', flag: '🇪🇸', country: 'Spain' },
  bundesliga: { name: 'Bundesliga', flag: '🇩🇪', country: 'Germany' },
  seriea: { name: 'Serie A', flag: '🇮🇹', country: 'Italy' },
  npfl: { name: 'NPFL', flag: '🇳🇬', country: 'Nigeria' },
  'caf-cl': { name: 'CAF Champions League', flag: '🏆', country: 'Africa' },
};

export const LeagueHub: React.FC = () => {
  const { leagueSlug } = useParams<{ leagueSlug: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedMatchIds, setVotedMatchIds] = useState<string[]>([]);
  const [hypeVotes, setHypeVotes] = useState<Record<string, { home: number; away: number }>>({});

  const leagueInfo = leagueSlug ? LEAGUE_NAMES[leagueSlug.toLowerCase()] : null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem('realssa_voted_matches');
      if (stored) setVotedMatchIds(JSON.parse(stored));
    } catch (e) {}
  }, []);

  useEffect(() => {
    const fetchLeagueData = async () => {
      if (!leagueSlug) return;
      try {
        setLoading(true);
        // 1. Fetch standings
        const standingsRes = await axios.get(apiUrl(`/api/sports/standings/${leagueSlug.toLowerCase()}`));
        setRows(standingsRes.data.standings || []);

        // 2. Fetch matches (filter matches corresponding to this league name)
        const matchesRes = await axios.get(apiUrl('/api/sports/live'));
        if (matchesRes.data) {
          const compName = leagueInfo?.name.toLowerCase() || leagueSlug.toLowerCase();
          const filtered = matchesRes.data.filter((m: Match) => 
            m.competition.toLowerCase().includes(compName) || 
            m.competition.toLowerCase().includes(leagueSlug.toLowerCase())
          );
          setFixtures(filtered);
          
          // Map initial hype votes
          const votesMap: Record<string, { home: number; away: number }> = {};
          filtered.forEach((m: Match) => {
            votesMap[m.match_id] = {
              home: m.home_hype_count || 0,
              away: m.away_hype_count || 0,
            };
          });
          setHypeVotes(votesMap);
        }
      } catch (err) {
        console.error('Failed to load league hub data:', err);
        toast({
          title: "Loading Failed",
          description: "Could not fetch standings or match data.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [leagueSlug, leagueInfo, toast]);

  const handleHypeVote = async (matchId: string, team: 'home' | 'away') => {
    if (votedMatchIds.includes(matchId)) return;
    try {
      const response = await axios.post(apiUrl(`/api/sports/matches/${matchId}/hype`), { team });
      setHypeVotes(prev => ({
        ...prev,
        [matchId]: {
          home: response.data.home_hype_count,
          away: response.data.away_hype_count,
        }
      }));
      setVotedMatchIds(prev => {
        const next = [...prev, matchId];
        localStorage.setItem('realssa_voted_matches', JSON.stringify(next));
        return next;
      });
      toast({
        title: "Vote Recorded!",
        description: `You hyped the ${team} team!`,
      });
    } catch (err) {
      console.error('Hype vote failed:', err);
    }
  };

  const getHypeSplit = (matchId: string, side: 'home' | 'away') => {
    const votes = hypeVotes[matchId];
    if (!votes) return 50;
    const total = votes.home + votes.away;
    if (total === 0) return 50;
    return Math.round((votes[side] / total) * 100);
  };

  if (!leagueInfo) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-slate-950 text-white px-4 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 animate-bounce" />
        <h2 className="text-xl font-bold">League Hub Not Found</h2>
        <p className="text-sm text-slate-400 max-w-xs">The requested tournament or league is not tracked by our scraper.</p>
        <Link to="/sports" className="inline-flex items-center gap-2 text-emerald-400 font-semibold hover:underline mt-2">
          <ArrowLeft className="w-4 h-4" /> Back to Sports Center
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 py-8 px-4 border-b border-emerald-900/30 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Link to="/sports" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition duration-200">
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <span className="text-sm font-semibold tracking-wider uppercase text-emerald-300">Tournament Hub</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg text-3xl">
              {leagueInfo.flag}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                {leagueInfo.name}
              </h1>
              <p className="text-sm text-slate-400 mt-1">{leagueInfo.country} Football League</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Standings Table */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-200">League Table Standings</h2>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">Live</span>
            </div>

            {loading ? (
              <div className="py-16 flex flex-col justify-center items-center gap-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="text-xs">Loading live standings...</span>
              </div>
            ) : rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-850 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                      <th className="px-3 py-3 text-left w-8">#</th>
                      <th className="px-3 py-3 text-left">Team</th>
                      <th className="px-2 py-3 text-center">P</th>
                      <th className="px-2 py-3 text-center">W</th>
                      <th className="px-2 py-3 text-center">D</th>
                      <th className="px-2 py-3 text-center">L</th>
                      <th className="px-2 py-3 text-center">GD</th>
                      <th className="px-3 py-3 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.team} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-3 text-slate-500 font-medium">{row.position}</td>
                        <td className="px-3 py-3 font-semibold text-slate-200 truncate max-w-[120px]">{row.team}</td>
                        <td className="px-2 py-3 text-center text-slate-400">{row.played}</td>
                        <td className="px-2 py-3 text-center text-emerald-400 font-medium">{row.won}</td>
                        <td className="px-2 py-3 text-center text-slate-400">{row.drawn}</td>
                        <td className="px-2 py-3 text-center text-red-400">{row.lost}</td>
                        <td className="px-2 py-3 text-center text-slate-400 font-mono">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                        <td className="px-3 py-3 text-center font-extrabold text-white">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                <Trophy className="w-8 h-8 text-slate-700" />
                <span className="text-xs text-slate-500">No standings data cached in database.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Match Fixtures & Hype Meter */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <span className="font-bold text-sm uppercase tracking-wider text-emerald-200 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" /> Matches & Hype
              </span>
            </div>

            <div className="p-4 flex flex-col gap-4 max-h-[480px] overflow-y-auto scrollbar-none">
              {fixtures.length > 0 ? (
                fixtures.map((m) => {
                  const hasHype = hypeVotes[m.match_id];
                  return (
                    <div key={m.match_id} className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold uppercase">
                        <span>{m.status === 'live' ? `Live • ${m.match_minute}'` : 'Fixture'}</span>
                        {m.kickoff_at && <span>{new Date(m.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                        <span className="truncate max-w-[90px]">{m.home_team}</span>
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">
                          {m.status === 'live' || m.status === 'finished' ? `${m.home_score} - ${m.away_score}` : 'vs'}
                        </span>
                        <span className="truncate max-w-[90px] text-right">{m.away_team}</span>
                      </div>

                      {/* Hype Progress splits */}
                      <div className="border-t border-slate-800/60 pt-2 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold">
                          <span>Home Hype: {getHypeSplit(m.match_id, 'home')}%</span>
                          <span>Away Hype: {getHypeSplit(m.match_id, 'away')}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${getHypeSplit(m.match_id, 'home')}%` }}></div>
                          <div className="bg-teal-500 h-full" style={{ width: `${getHypeSplit(m.match_id, 'away')}%` }}></div>
                        </div>
                        
                        {/* Vote buttons */}
                        <div className="mt-1 flex gap-1">
                          <button
                            disabled={votedMatchIds.includes(m.match_id)}
                            onClick={() => handleHypeVote(m.match_id, 'home')}
                            className="flex-1 text-[9px] font-bold bg-emerald-500/10 hover:bg-emerald-500/25 active:scale-[0.98] border border-emerald-500/15 py-1 rounded text-emerald-300 disabled:opacity-40"
                          >
                            Vote Home
                          </button>
                          <button
                            disabled={votedMatchIds.includes(m.match_id)}
                            onClick={() => handleHypeVote(m.match_id, 'away')}
                            className="flex-1 text-[9px] font-bold bg-teal-500/10 hover:bg-teal-500/25 active:scale-[0.98] border border-teal-500/15 py-1 rounded text-teal-300 disabled:opacity-40"
                          >
                            Vote Away
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5">
                  <Vote className="w-6 h-6 text-slate-700" />
                  <span>No matches loaded for this league today.</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LeagueHub;
