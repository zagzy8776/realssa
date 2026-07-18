import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, Wind, Play, Trophy, Users, ShieldAlert, Award } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import axios from 'axios';

interface AtAGlanceCarouselProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

interface WeatherData {
  temp: string;
  condition: string;
  location: string;
  windSpeed: string;
  humidity: string;
}

interface MatchData {
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
}

export const AtAGlanceCarousel: React.FC<AtAGlanceCarouselProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [hypeVotes, setHypeVotes] = useState<{ home: number; away: number } | null>(null);
  const [votedMatchId, setVotedMatchId] = useState<string | null>(null);

  // 1. Fetch Geolocation and Weather
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setWeatherLoading(true);
        // Request geolocation permissions
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          await Geolocation.requestPermissions();
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000,
        });

        const { latitude, longitude } = position.coords;
        // Fetch weather from wttr.in in JSON format
        const response = await axios.get(`https://wttr.in/${latitude},${longitude}?format=j1`);
        const current = response.data.current_condition[0];
        const area = response.data.nearest_area[0];
        
        setWeather({
          temp: `${current.temp_C}°C`,
          condition: current.weatherDesc[0].value,
          location: area.areaName[0].value || 'Local Area',
          windSpeed: `${current.windspeedKmph} km/h`,
          humidity: `${current.humidity}%`,
        });
      } catch (err) {
        console.error('Weather widget fetch failed:', err);
        // Fallback default city (Lagos/London etc. based on region)
        setWeather({
          temp: '28°C',
          condition: 'Partly Cloudy',
          location: 'Lagos, NG',
          windSpeed: '12 km/h',
          humidity: '74%',
        });
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, []);

  // 2. Fetch Live Matches from RealSSA API
  useEffect(() => {
    const fetchLiveMatch = async () => {
      try {
        const response = await axios.get('/api/sports/live');
        if (response.data && response.data.length > 0) {
          // Select first live match, or first scheduled match
          const activeMatch = response.data.find((m: MatchData) => m.status === 'live') || response.data[0];
          setMatch(activeMatch);
          setHypeVotes({
            home: activeMatch.home_hype_count || 0,
            away: activeMatch.away_hype_count || 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch sports widget:', err);
      }
    };

    fetchLiveMatch();
    const interval = setInterval(fetchLiveMatch, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // 3. Hype Meter Vote Handler
  const handleHypeVote = async (team: 'home' | 'away') => {
    if (!match || votedMatchId === match.match_id) return;
    try {
      const response = await axios.post(`/api/sports/matches/${match.match_id}/hype`, { team });
      setHypeVotes({
        home: response.data.home_hype_count,
        away: response.data.away_hype_count,
      });
      setVotedMatchId(match.match_id);
    } catch (err) {
      console.error('Hype vote submission failed:', err);
    }
  };

  const getHypePercentage = (side: 'home' | 'away') => {
    if (!hypeVotes) return 50;
    const total = hypeVotes.home + hypeVotes.away;
    if (total === 0) return 50;
    return Math.round((hypeVotes[side] / total) * 100);
  };

  const getWeatherIcon = (cond: string) => {
    const c = cond.toLowerCase();
    if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return <CloudRain className="w-8 h-8 text-blue-300 animate-bounce" />;
    if (c.includes('cloud') || c.includes('overcast') || c.includes('mist')) return <Cloud className="w-8 h-8 text-gray-300" />;
    return <Sun className="w-8 h-8 text-yellow-400 animate-spin-slow" />;
  };

  return (
    <div className="w-full py-4 px-4 bg-background border-b border-border select-none overflow-hidden">
      {/* 1. Horizontal Scroll Widgets row */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none flex-nowrap">
        
        {/* Weather Card */}
        <div className="w-[280px] md:w-[320px] flex-shrink-0 bg-gradient-to-br from-indigo-900/90 via-purple-900/80 to-blue-900/90 rounded-2xl p-4 shadow-lg border border-white/10 text-white backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
          <div className="absolute top-0 right-0 p-3 opacity-20">
            <Sun className="w-24 h-24 text-white" />
          </div>
          {weatherLoading ? (
            <div className="h-28 flex flex-col justify-center items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              <span className="text-xs text-white/60">Fetching local micro-weather...</span>
            </div>
          ) : (
            weather && (
              <div className="flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-200">Local Weather</h3>
                    <p className="text-sm font-medium text-white/80">{weather.location}</p>
                  </div>
                  {getWeatherIcon(weather.condition)}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight">{weather.temp}</span>
                  <span className="text-xs font-medium text-indigo-200 bg-white/10 px-2 py-0.5 rounded-full">{weather.condition}</span>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-white/70 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-blue-300" />
                    <span>{weather.windSpeed}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CloudRain className="w-3.5 h-3.5 text-indigo-300" />
                    <span>{weather.humidity} humidity</span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Live Sports Card (Hype Loop) */}
        <div className="w-[280px] md:w-[320px] flex-shrink-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-4 shadow-lg border border-white/10 text-white backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
          {match ? (
            <div className="flex flex-col justify-between h-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                  {match.status === 'live' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      <span>Live • {match.match_minute}'</span>
                    </>
                  ) : (
                    <span>Upcoming Fixture</span>
                  )}
                </div>
                <Trophy className="w-4 h-4 text-yellow-400" />
              </div>

              {/* Match Header */}
              <div className="mt-2 text-center text-xs text-white/50 truncate font-medium">
                {match.competition}
              </div>

              {/* Scores / Teams */}
              <div className="mt-3 flex items-center justify-between px-2">
                <div className="w-[40%] text-center">
                  <div className="text-sm font-semibold truncate" title={match.home_team}>{match.home_team}</div>
                </div>
                <div className="w-[20%] text-center bg-white/10 rounded-lg py-1 px-2 font-mono font-bold text-lg">
                  {match.status === 'live' || match.status === 'finished' ? (
                    `${match.home_score}-${match.away_score}`
                  ) : (
                    'VS'
                  )}
                </div>
                <div className="w-[40%] text-center">
                  <div className="text-sm font-semibold truncate" title={match.away_team}>{match.away_team}</div>
                </div>
              </div>

              {/* Interactive Hype Meter */}
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="flex justify-between items-center text-xs text-white/60 mb-2">
                  <span>Hype Meter</span>
                  <span className="font-mono text-[10px] text-emerald-300">
                    {getHypePercentage('home')}% vs {getHypePercentage('away')}%
                  </span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${getHypePercentage('home')}%` }}></div>
                  <div className="bg-teal-400 h-full transition-all duration-500" style={{ width: `${getHypePercentage('away')}%` }}></div>
                </div>
                
                {/* Vote buttons */}
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={votedMatchId === match.match_id}
                    onClick={() => handleHypeVote('home')}
                    className="flex-1 text-[10px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-[0.98] border border-emerald-500/20 py-1 rounded-md transition-all duration-200 disabled:opacity-50 text-emerald-200"
                  >
                    Hype Home
                  </button>
                  <button
                    disabled={votedMatchId === match.match_id}
                    onClick={() => handleHypeVote('away')}
                    className="flex-1 text-[10px] font-semibold bg-teal-500/20 hover:bg-teal-500/30 active:scale-[0.98] border border-teal-500/20 py-1 rounded-md transition-all duration-200 disabled:opacity-50 text-teal-200"
                  >
                    Hype Away
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center gap-2">
              <Trophy className="w-8 h-8 text-white/20" />
              <span className="text-xs text-white/40">No fixtures matches scheduled</span>
            </div>
          )}
        </div>

        {/* Community Verification info card */}
        <div className="w-[280px] md:w-[320px] flex-shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-950 border border-white/10 rounded-2xl p-4 shadow-lg text-white backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
          <div className="flex flex-col justify-between h-full">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Community Proof</h3>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-xs text-white/70 leading-relaxed">
              Google ranks SEO giants. We aggregate grassroots sources. Join us in flagging rumors and verifying ground-truths directly on articles!
            </div>
            <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
              <div className="flex-1 text-center bg-white/5 rounded-lg py-1.5 border border-white/5">
                <div className="text-[10px] uppercase text-white/40">Powering</div>
                <div className="text-xs font-bold text-amber-300">Truth & Speed</div>
              </div>
              <div className="flex-1 text-center bg-white/5 rounded-lg py-1.5 border border-white/5">
                <div className="text-[10px] uppercase text-white/40">Network</div>
                <div className="text-xs font-bold text-emerald-300">Zero Ad Bloat</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Intent-Driven Feed Knobs (User controls for feed filtering) */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Intent-Driven Feed</span>
        <div className="flex gap-2">
          <button
            onClick={() => onFilterChange(activeFilter === 'deep_dives' ? 'all' : 'deep_dives')}
            className={`text-xs px-3 py-1 rounded-full border transition-all duration-300 font-semibold ${
              activeFilter === 'deep_dives'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20 scale-[1.03]'
                : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/60'
            }`}
          >
            [Deep Dives Only]
          </button>
          <button
            onClick={() => onFilterChange(activeFilter === 'facts' ? 'all' : 'facts')}
            className={`text-xs px-3 py-1 rounded-full border transition-all duration-300 font-semibold ${
              activeFilter === 'facts'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20 scale-[1.03]'
                : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/60'
            }`}
          >
            [Just the Facts]
          </button>
          <button
            onClick={() => onFilterChange(activeFilter === 'local' ? 'all' : 'local')}
            className={`text-xs px-3 py-1 rounded-full border transition-all duration-300 font-semibold ${
              activeFilter === 'local'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20 scale-[1.03]'
                : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/60'
            }`}
          >
            [Hyper-Local]
          </button>
        </div>
      </div>
    </div>
  );
};
