import { useState, useEffect } from 'react';
import { Globe, Trophy, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

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

interface League {
  id: string;
  name: string;
  country: string;
  flag: string;
}

interface LeagueGroup {
  label: string;
  emoji: string;
  leagues: League[];
}

const LEAGUE_GROUPS: LeagueGroup[] = [
  {
    label: 'African', emoji: '🌍',
    leagues: [
      { id: 'npfl',   name: 'NPFL',             country: 'Nigeria',   flag: '🇳🇬' },
      { id: 'caf-cl', name: 'CAF Champions',    country: 'Africa',    flag: '🏆'  },
      { id: 'epl',    name: 'Premier League',   country: 'England',   flag: '🏴'  },
    ],
  },
  {
    label: 'European', emoji: '⚽',
    leagues: [
      { id: 'epl',        name: 'Premier League', country: 'England', flag: '🏴' },
      { id: 'laliga',     name: 'La Liga',         country: 'Spain',   flag: '🇪🇸' },
      { id: 'bundesliga', name: 'Bundesliga',      country: 'Germany', flag: '🇩🇪' },
      { id: 'seriea',     name: 'Serie A',         country: 'Italy',   flag: '🇮🇹' },
    ],
  },
];

function LeagueTable({ slug }: { slug: string }) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/sports/standings/${slug}`)
      .then(r => r.json())
      .then(data => {
        setRows(data.standings || []);
        setScrapedAt(data.scraped_at || null);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 gap-2">
      <RefreshCw size={18} className="animate-spin" /> Loading standings...
    </div>
  );

  if (rows.length === 0) return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2 text-sm">
      <Trophy size={32} className="opacity-30" />
      <p>No standings data available for this league currently.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <th className="px-3 py-2 text-left w-8">#</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-2 py-2 text-center">P</th>
            <th className="px-2 py-2 text-center">W</th>
            <th className="px-2 py-2 text-center">D</th>
            <th className="px-2 py-2 text-center">L</th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">GF</th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">GA</th>
            <th className="px-2 py-2 text-center">GD</th>
            <th className="px-3 py-2 text-center font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.team} className={`border-t border-gray-100 hover:bg-green-50 transition-colors ${i < 4 ? 'border-l-2 border-l-green-500' : i < 6 ? 'border-l-2 border-l-blue-400' : ''}`}>
              <td className="px-3 py-2.5 text-gray-400 font-medium">{row.position}</td>
              <td className="px-3 py-2.5 font-semibold text-gray-800 truncate max-w-[140px]">{row.team}</td>
              <td className="px-2 py-2.5 text-center text-gray-600">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-green-600 font-medium">{row.won}</td>
              <td className="px-2 py-2.5 text-center text-gray-500">{row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-red-500">{row.lost}</td>
              <td className="px-2 py-2.5 text-center text-gray-500 hidden sm:table-cell">{row.gf}</td>
              <td className="px-2 py-2.5 text-center text-gray-500 hidden sm:table-cell">{row.ga}</td>
              <td className="px-2 py-2.5 text-center text-gray-600">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
              <td className="px-3 py-2.5 text-center font-bold text-gray-900">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {scrapedAt && (
        <p className="text-xs text-gray-400 text-right px-4 py-2">
          Updated {new Date(scrapedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

const SportsLeagueTables = () => {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeLeagueId, setActiveLeagueId] = useState(LEAGUE_GROUPS[0].leagues[0].id);

  const activeGroup = LEAGUE_GROUPS[activeGroupIndex];
  const activeLeague = activeGroup.leagues.find(l => l.id === activeLeagueId) ?? activeGroup.leagues[0];

  const handleGroupChange = (idx: number) => {
    setActiveGroupIndex(idx);
    setActiveLeagueId(LEAGUE_GROUPS[idx].leagues[0].id);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-4 flex items-center gap-3">
        <span className="text-3xl">⚽</span>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Football League Tables</h2>
          <p className="text-green-100 text-sm flex items-center gap-1 mt-0.5">
            <Globe size={12} /> Live standings — updated every 30 minutes
          </p>
        </div>
      </div>

      {/* Group tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 scrollbar-hide">
        {LEAGUE_GROUPS.map((group, idx) => (
          <button
            key={group.label}
            onClick={() => handleGroupChange(idx)}
            className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              idx === activeGroupIndex
                ? 'border-green-600 text-green-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{group.emoji}</span>{group.label}
          </button>
        ))}
      </div>

      {/* League tabs */}
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-white border-b border-gray-100">
        {activeGroup.leagues.map(league => (
          <button
            key={league.id}
            onClick={() => setActiveLeagueId(league.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              league.id === activeLeague.id
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="text-base leading-none">{league.flag}</span>
            {league.name}
            <span className="text-xs opacity-70">· {league.country}</span>
          </button>
        ))}
      </div>

      {/* Active league info bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-green-50 border-b border-green-100">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-green-600" />
          <span className="font-semibold text-gray-800 text-sm">{activeLeague.name}</span>
          <span className="text-gray-400 text-sm">·</span>
          <span className="text-gray-500 text-sm">{activeLeague.country}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs text-green-700 font-medium">Live</span>
        </div>
      </div>

      {/* Native table */}
      <LeagueTable key={activeLeague.id} slug={activeLeague.id} />
    </div>
  );
};

export default SportsLeagueTables;
