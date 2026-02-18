import { useState, useEffect } from 'react';
import {
  RefreshCw, ExternalLink, Trophy, Clock, X, ChevronDown, ChevronUp,
  Newspaper, BarChart3, AlertCircle
} from 'lucide-react';

// API Configuration
const API_URL = 'https://realssasportsapi-production.up.railway.app/scores';

// Types
interface Match {
  id: number;
  date: string;
  home_team: string;
  away_team: string;
  home_team_id?: number;
  away_team_id?: number;
  home_team_logo?: string;
  away_team_logo?: string;
  home_score: number;
  away_score: number;
  home_score_ht?: number;
  away_score_ht?: number;
  statusId: number;
  statusName: string;
  time?: string;
  league?: string;
  league_country?: string;
  league_logo?: string;
  timestamp?: number;
}

type DateTab = 'live' | 'yesterday' | 'today' | 'all';

// Utility Functions
const formatMatchTime = (timestamp?: number): string => {
  if (!timestamp) return 'TBD';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const getDateCategory = (timestamp?: number): 'yesterday' | 'today' | 'tomorrow' | 'future' => {
  if (!timestamp) return 'future';
  
  const matchDate = new Date(timestamp * 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const matchDay = new Date(matchDate);
  matchDay.setHours(0, 0, 0, 0);
  
  if (matchDay.getTime() === yesterday.getTime()) return 'yesterday';
  if (matchDay.getTime() === today.getTime()) return 'today';
  if (matchDay.getTime() === tomorrow.getTime()) return 'tomorrow';
  return 'future';
};

const formatFullDate = (timestamp?: number): string => {
  if (!timestamp) return 'Date TBD';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric'
  });
};

// Match Detail Modal (updated – no stats)
const MatchDetailModal = ({ match, onClose }: { 
  match: Match; 
  onClose: () => void;
}) => {
  const [homeLogoError, setHomeLogoError] = useState(false);
  const [awayLogoError, setAwayLogoError] = useState(false);
  const [leagueLogoError, setLeagueLogoError] = useState(false);

  const isLive = match.statusId === 2;
  const isFinished = match.statusId === 6;
  const matchTime = formatMatchTime(match.timestamp);
  const fullDate = formatFullDate(match.timestamp);
  const dateCategory = getDateCategory(match.timestamp);

  const getMatchDateTime = () => {
    if (isLive) return { label: 'Live Now', icon: '🔴', color: 'bg-green-100 text-green-800' };
    if (isFinished) {
      const label = dateCategory === 'yesterday' ? 'Yesterday' : 'Match Ended';
      return { label, icon: '✅', color: 'bg-gray-100 text-gray-700' };
    }
    const label = dateCategory === 'today' ? 'Today' : dateCategory === 'tomorrow' ? 'Tomorrow' : 'Upcoming';
    return { label, icon: '📅', color: 'bg-blue-100 text-blue-800' };
  };

  const matchDateTime = getMatchDateTime();

  const handleViewNews = () => {
    const searchQuery = `${match.home_team} vs ${match.away_team} ${match.league || 'football'} highlights news`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=nws`, '_blank');
  };

  const handleViewHighlights = () => {
    const query = `${match.home_team} vs ${match.away_team} highlights`;
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Match Details</h3>
              <p className="text-xs text-white/80 mt-1">{fullDate}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className={`mb-5 p-4 rounded-xl flex items-center gap-3 ${matchDateTime.color}`}>
            <span className="text-2xl">{matchDateTime.icon}</span>
            <div className="flex-1">
              <p className="font-bold text-lg">{matchDateTime.label}</p>
              {matchTime && <p className="text-sm opacity-75 mt-0.5">{matchTime}</p>}
            </div>
            {isLive && (
              <span className="px-3 py-1.5 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse shadow-md">
                LIVE
              </span>
            )}
          </div>

          {match.league && (
            <div className="mb-5 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                {match.league_logo && !leagueLogoError ? (
                  <img 
                    src={match.league_logo} 
                    alt={match.league} 
                    className="w-8 h-8 object-contain"
                    onError={() => setLeagueLogoError(true)}
                  />
                ) : (
                  <Trophy size={20} className="text-gray-400" />
                )}
                <div>
                  <p className="font-bold text-gray-900">{match.league}</p>
                  {match.league_country && <p className="text-xs text-gray-500">{match.league_country}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm">
                  {match.home_team_logo && !homeLogoError ? (
                    <img 
                      src={match.home_team_logo} 
                      alt={match.home_team} 
                      className="w-10 h-10 object-contain"
                      onError={() => setHomeLogoError(true)}
                    />
                  ) : (
                    <span className="text-xl font-bold text-gray-400">
                      {match.home_team?.substring(0, 2).toUpperCase() || 'H'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{match.home_team || 'Home Team'}</p>
                  <p className="text-xs text-gray-500">Home</p>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className={`text-4xl font-bold ${isLive ? 'text-green-600' : 'text-gray-900'}`}>
                  {match.home_score ?? 0}
                </p>
                {match.home_score_ht !== undefined && (
                  <p className="text-xs text-gray-400 mt-1">HT: {match.home_score_ht}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <span className={`px-4 py-1.5 rounded-lg text-sm font-bold ${
                isLive ? 'bg-green-100 text-green-700' : 
                isFinished ? 'bg-gray-200 text-gray-700' : 
                'bg-blue-100 text-blue-700'
              }`}>
                {match.statusName || 'VS'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm">
                  {match.away_team_logo && !awayLogoError ? (
                    <img 
                      src={match.away_team_logo} 
                      alt={match.away_team} 
                      className="w-10 h-10 object-contain"
                      onError={() => setAwayLogoError(true)}
                    />
                  ) : (
                    <span className="text-xl font-bold text-gray-400">
                      {match.away_team?.substring(0, 2).toUpperCase() || 'A'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{match.away_team || 'Away Team'}</p>
                  <p className="text-xs text-gray-500">Away</p>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className={`text-4xl font-bold ${isLive ? 'text-green-600' : 'text-gray-900'}`}>
                  {match.away_score ?? 0}
                </p>
                {match.away_score_ht !== undefined && (
                  <p className="text-xs text-gray-400 mt-1">HT: {match.away_score_ht}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleViewNews}
              className="flex-1 bg-green-600 text-white py-3.5 rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-md"
            >
              <Newspaper size={18} />
              View News
            </button>
            <button 
              onClick={handleViewHighlights}
              className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              Highlights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Match Card Component  
const MatchCard = ({ match, onClick }: { match: Match; onClick: () => void }) => {
  const [homeLogoError, setHomeLogoError] = useState(false);
  const [awayLogoError, setAwayLogoError] = useState(false);
  const [leagueLogoError, setLeagueLogoError] = useState(false);
  
  const isLive = match.statusId === 2;
  const isFinished = match.statusId === 6;
  const matchTime = formatMatchTime(match.timestamp);
  
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl p-4 transition-all cursor-pointer border ${
        isLive 
          ? 'border-green-400 shadow-lg shadow-green-100 ring-2 ring-green-100' 
          : isFinished 
          ? 'border-gray-200 hover:border-gray-300 hover:shadow-md' 
          : 'border-gray-200 hover:border-green-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.league_logo && !leagueLogoError ? (
            <img 
              src={match.league_logo} 
              alt={match.league} 
              className="w-4 h-4 object-contain flex-shrink-0"
              onError={() => setLeagueLogoError(true)}
            />
          ) : (
            <Trophy size={14} className="text-gray-400 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold text-gray-700 truncate">
            {match.league || 'Football Match'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {isLive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              LIVE
            </span>
          )}
          {!isLive && !isFinished && matchTime && (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
              {matchTime}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
              {match.home_team_logo && !homeLogoError ? (
                <img 
                  src={match.home_team_logo} 
                  alt={match.home_team} 
                  className="w-6 h-6 object-contain"
                  onError={() => setHomeLogoError(true)}
                />
              ) : (
                <span className="text-xs font-bold text-gray-400">
                  {match.home_team?.substring(0, 2).toUpperCase() || 'H'}
                </span>
              )}
            </div>
            <span className="font-semibold text-sm text-gray-900 truncate">
              {match.home_team || 'Home Team'}
            </span>
          </div>
          <span className={`font-bold text-2xl flex-shrink-0 ${
            isLive ? 'text-green-600' : 
            isFinished ? 'text-gray-800' :
            'text-gray-400'
          }`}>
            {match.home_score ?? 0}
          </span>
        </div>
        
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
              {match.away_team_logo && !awayLogoError ? (
                <img 
                  src={match.away_team_logo} 
                  alt={match.away_team} 
                  className="w-6 h-6 object-contain"
                  onError={() => setAwayLogoError(true)}
                />
              ) : (
                <span className="text-xs font-bold text-gray-400">
                  {match.away_team?.substring(0, 2).toUpperCase() || 'A'}
                </span>
              )}
            </div>
            <span className="font-semibold text-sm text-gray-900 truncate">
              {match.away_team || 'Away Team'}
            </span>
          </div>
          <span className={`font-bold text-2xl flex-shrink-0 ${
            isLive ? 'text-green-600' : 
            isFinished ? 'text-gray-800' :
            'text-gray-400'
          }`}>
            {match.away_score ?? 0}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
          isLive ? 'bg-green-100 text-green-700' : 
          isFinished ? 'bg-gray-100 text-gray-600' : 
          'bg-blue-100 text-blue-700'
        }`}>
          {match.statusName || 'VS'}
        </span>
        {match.home_score_ht !== undefined && match.away_score_ht !== undefined && (
          <span className="text-xs text-gray-400 font-medium">
            HT: {match.home_score_ht}-{match.away_score_ht}
          </span>
        )}
      </div>
    </div>
  );
};

// Main Component
const LiveScores = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<DateTab>('live');
  const [showAll, setShowAll] = useState(false);

  const fetchScores = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(API_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch scores (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      setMatches(data.data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching scores:', err);
      setError(err instanceof Error ? err.message : 'Unable to load scores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 45000); // 45 seconds
    return () => clearInterval(interval);
  }, []);

  // Filter matches by tab
  const liveMatches = matches.filter(m => m.statusId === 2);
  const yesterdayMatches = matches.filter(m => getDateCategory(m.timestamp) === 'yesterday' && m.statusId === 6);
  const todayMatches = matches.filter(m => getDateCategory(m.timestamp) === 'today' && m.statusId !== 2);
  
  const getFilteredMatches = () => {
    switch (activeTab) {
      case 'live':
        return liveMatches;
      case 'yesterday':
        return yesterdayMatches;
      case 'today':
        return todayMatches;
      case 'all':
      default:
        return matches;
    }
  };

  const filteredMatches = getFilteredMatches();
  const displayedMatches = showAll ? filteredMatches : filteredMatches.slice(0, 8);

  if (loading && matches.length === 0) {
    return (
      <div className="bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 rounded-2xl p-6 mb-8 shadow-xl text-white">
        <div className="flex items-center gap-3 mb-6">
          <RefreshCw className="animate-spin" size={24} />
          <h2 className="text-2xl font-bold">Loading Football Scores...</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/10 rounded-xl p-4 animate-pulse h-40"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && matches.length === 0) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="text-red-600" size={32} />
          <div>
            <h3 className="text-lg font-bold text-red-900">Unable to Load Scores</h3>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
        <button 
          onClick={fetchScores}
          className="mt-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition shadow-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 rounded-2xl p-6 mb-8 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl">⚽</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Live Football Scores</h2>
              {lastUpdated && (
                <p className="text-sm text-white/80 flex items-center gap-1.5 mt-1">
                  <Clock size={14} />
                  Updated {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={fetchScores}
            disabled={refreshing}
            className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition disabled:opacity-50 backdrop-blur-sm"
          >
            <RefreshCw size={22} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Date Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-5 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'live'
                ? 'bg-white text-green-700 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {liveMatches.length > 0 && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
            LIVE {liveMatches.length > 0 && `(${liveMatches.length})`}
          </button>
          <button
            onClick={() => setActiveTab('yesterday')}
            className={`px-5 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'yesterday'
                ? 'bg-white text-green-700 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`px-5 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'today'
                ? 'bg-white text-green-700 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-white text-green-700 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            All ({matches.length})
          </button>
        </div>

        {/* Matches Grid */}
        {filteredMatches.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedMatches.map(match => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  onClick={() => setSelectedMatch(match)}
                />
              ))}
            </div>

            {filteredMatches.length > 8 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-3 mt-6 bg-white/10 hover:bg-white/20 rounded-xl transition flex items-center justify-center gap-2 font-semibold backdrop-blur-sm"
              >
                {showAll ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                <span>{showAll ? 'Show Less' : `View All ${filteredMatches.length} Matches`}</span>
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-20 text-white/90">
            <span className="text-7xl mb-5 block">😴</span>
            <p className="text-2xl font-bold mb-2">No Matches Right Now</p>
            <p className="text-white/70">
              {activeTab === 'live' ? 'No live games at the moment' : 'No matches in this tab'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/20 text-center">
          <a 
            href="/sports" 
            className="inline-flex items-center gap-2 text-white/90 hover:text-white font-semibold transition"
          >
            View Full Sports Page
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal 
          match={selectedMatch} 
          onClose={() => setSelectedMatch(null)}
        />
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default LiveScores;