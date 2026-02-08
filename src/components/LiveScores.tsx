import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Trophy, Clock } from 'lucide-react';

interface SportMonksMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: string; // LIVE, FT, HT, SCHEDULED
  league: string;
  country: string;
  homeLogo?: string;
  awayLogo?: string;
  startingAt?: string;
}

interface SportMonksResponse {
  status: string;
  source: string;
  response: SportMonksMatch[];
  timestamp: number;
  server: string;
  liveCount: number;
}

const LiveScores = () => {
  const [matches, setMatches] = useState<SportMonksMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filter to show only important leagues
  const importantLeagues = ['Premier League', 'NPFL', 'Ligue 1', 'La Liga', 'Serie A', 'Bundesliga', 'Champions League', 'Europa League', 'EFL Cup', 'FA Cup'];

  const fetchScores = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('https://realssasportsapi-production.up.railway.app/scores');
      
      if (!response.ok) {
        throw new Error('Failed to fetch scores');
      }

      const data: SportMonksResponse = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message || 'API Error');
      }

      setMatches(data.response || []);
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
    const interval = setInterval(fetchScores, 120000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  // Filter matches by important leagues
  const filteredMatches = matches.filter(m => 
    importantLeagues.some(l => m.league?.toLowerCase().includes(l.toLowerCase())) ||
    m.country?.toLowerCase().includes('england') ||
    m.country?.toLowerCase().includes('nigeria')
  );

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'LIVE': return 'text-green-600 bg-green-100';
      case 'HT': return 'text-yellow-600 bg-yellow-100';
      case 'FT': return 'text-gray-600 bg-gray-100';
      case 'PEN': return 'text-purple-600 bg-purple-100';
      case 'SCHEDULED': return 'text-blue-600 bg-blue-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const formatTime = (startingAt?: string) => {
    if (!startingAt) return '';
    try {
      const date = new Date(startingAt);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
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
          <span className="font-semibold">⚽ Scores Unavailable</span>
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
      {/* Header */}
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

      {/* Match Count */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Trophy size={14} />
        <span>{matches.length} matches tracked</span>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMatches.slice(0, 6).map(match => (
            <div 
              key={match.id}
              className="bg-white/10 backdrop-blur rounded-lg p-4 hover:bg-white/20 transition cursor-pointer"
            >
              {/* League & Country */}
              <div className="flex items-center gap-2 mb-2 text-xs text-white/70">
                {match.homeLogo && (
                  <img 
                    src={match.homeLogo} 
                    alt={match.league}
                    className="w-4 h-4 rounded-full"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                )}
                <span>{match.league || 'Unknown League'}</span>
              </div>

              {/* Teams & Score */}
              <div className="space-y-2">
                {/* Home Team */}
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
                    <span className="font-medium text-sm truncate max-w-[100px]">
                      {match.homeTeam || 'TBD'}
                    </span>
                  </div>
                  <span className="font-bold text-lg">{match.homeScore ?? '-'}</span>
                </div>

                {/* Away Team */}
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
                    <span className="font-medium text-sm truncate max-w-[100px]">
                      {match.awayTeam || 'TBD'}
                    </span>
                  </div>
                  <span className="font-bold text-lg">{match.awayScore ?? '-'}</span>
                </div>
              </div>

              {/* Match Time/Status */}
              <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(match.status)}`}>
                  {match.status === 'LIVE' ? `${match.minute}'` : 
                   match.status === 'SCHEDULED' ? formatTime(match.startingAt) : 
                   match.status}
                </span>
                <ExternalLink size={12} className="text-white/50" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-white/70">
          <span className="text-4xl mb-2 block">😴</span>
          <p>No major league matches</p>
          <p className="text-sm text-white/50">Check back during match hours</p>
          {matches.length > 0 && (
            <p className="text-xs text-white/50 mt-2">
              {matches.length} other matches available
            </p>
          )}
        </div>
      )}

      {/* View All Link */}
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
