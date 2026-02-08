import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Trophy, Clock } from 'lucide-react';

interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: string;
  league: string;
  homeLogo?: string;
  awayLogo?: string;
}

// API Response types
interface ApiResponse {
  response: {
    fixture?: { id: number; status?: { elapsed?: number; short?: string } };
    teams?: {
      home?: { name?: string; logo?: string };
      away?: { name?: string; logo?: string };
    };
    goals?: { home?: number; away?: number };
    league?: { name?: string };
  }[];
}

const LiveScores = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Your Railway backend URL
  const API_URL = 'https://realssasportsapi-production.up.railway.app';

  // Filter to show only important leagues
  const importantLeagues = ['Premier League', 'NPFL', 'Ligue 1', 'La Liga', 'Serie A', 'Bundesliga', 'Champions League', 'Europa League'];

  const fetchScores = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_URL}/scores`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch scores');
      }

      const data = await response.json();
      
      // Handle api-football format
      let matchesArray: Match[] = [];
      
      if (data.response && Array.isArray(data.response)) {
        matchesArray = data.response.map((item) => ({
          id: item.fixture?.id || Math.random(),
          homeTeam: item.teams?.home?.name || 'TBD',
          awayTeam: item.teams?.away?.name || 'TBD',
          homeScore: item.goals?.home ?? 0,
          awayScore: item.goals?.away ?? 0,
          minute: item.fixture?.status?.elapsed || 0,
          status: item.fixture?.status?.short || 'SCHEDULED',
          league: item.league?.name || 'Unknown',
          homeLogo: item.teams?.home?.logo,
          awayLogo: item.teams?.away?.logo,
        }));
      }

      setMatches(matchesArray);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching live scores:', err);
      setError('Unable to load live scores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredMatches = matches.filter(m => 
    importantLeagues.some(l => m.league?.toLowerCase().includes(l.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'LIVE': return 'text-green-600 bg-green-100';
      case 'HT': return 'text-yellow-600 bg-yellow-100';
      case 'FT': return 'text-gray-600 bg-gray-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  if (loading && matches.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="animate-spin text-white" size={20} />
          <span className="text-white font-semibold">Loading Live Scores...</span>
        </div>
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/20 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/30 rounded mb-2 w-1/3"></div>
              <div className="h-6 bg-white/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && matches.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 text-red-600">
          <span className="font-semibold">Scores Unavailable</span>
        </div>
        <p className="text-red-500 text-sm mt-1">{error}</p>
        <button 
          onClick={fetchScores}
          className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-green-700 to-emerald-700 rounded-xl p-6 mb-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-xl">⚽</span>
          </div>
          <div>
            <h2 className="text-xl font-bold">Live Scores</h2>
            {lastUpdated && (
              <p className="text-xs text-white/70 flex items-center gap-1">
                <Clock size={12} />
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchScores}
          disabled={refreshing}
          className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm">
        <Trophy size={14} />
        <span>{matches.length} matches</span>
      </div>

      {filteredMatches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMatches.slice(0, 6).map(match => (
            <div 
              key={match.id}
              className="bg-white/10 backdrop-blur rounded-lg p-4 hover:bg-white/20 transition cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-white/70">
                <span>{match.league}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {match.homeLogo && (
                      <img 
                        src={match.homeLogo} 
                        alt={match.homeTeam}
                        className="w-5 h-5"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                    <span className="font-medium text-sm truncate max-w-[100px]">{match.homeTeam}</span>
                  </div>
                  <span className="font-bold text-lg">{match.homeScore}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {match.awayLogo && (
                      <img 
                        src={match.awayLogo} 
                        alt={match.awayTeam}
                        className="w-5 h-5"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                    <span className="font-medium text-sm truncate max-w-[100px]">{match.awayTeam}</span>
                  </div>
                  <span className="font-bold text-lg">{match.awayScore}</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(match.status)}`}>
                  {match.status === 'LIVE' ? `${match.minute}'` : match.status}
                </span>
                <ExternalLink size={12} className="text-white/50" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-white/70">
          <span className="text-4xl mb-2 block">😴</span>
          <p>No major league matches live</p>
          <p className="text-sm text-white/50">Check back during match hours</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/20 text-center">
        <a 
          href="/sports" 
          className="inline-flex items-center gap-2 text-white/90 hover:text-white font-medium text-sm"
        >
          View All Scores & News
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
};

export default LiveScores;
