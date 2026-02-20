import { useState } from 'react';
import { Globe, Trophy } from 'lucide-react';

interface League {
  id: string;
  name: string;
  country: string;
  flag: string;
  leagueID: number;
}

interface LeagueGroup {
  label: string;
  emoji: string;
  leagues: League[];
}

const LEAGUE_GROUPS: LeagueGroup[] = [
  {
    label: 'British',
    emoji: '🇬🇧',
    leagues: [
      {
        id: 'epl',
        name: 'Premier League',
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        leagueID: 15050,
      },
      {
        id: 'championship',
        name: 'Championship',
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        leagueID: 14930,
      },
      {
        id: 'league-one',
        name: 'League One',
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        leagueID: 14934,
      },
      {
        id: 'league-two',
        name: 'League Two',
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        leagueID: 14935,
      },
      {
        id: 'scottish-premiership',
        name: 'Premiership',
        country: 'Scotland',
        flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        leagueID: 15000,
      },
    ],
  },
  {
    label: 'Top European',
    emoji: '⚽',
    leagues: [
      {
        id: 'laliga',
        name: 'La Liga',
        country: 'Spain',
        flag: '🇪🇸',
        leagueID: 14956,
      },
      {
        id: 'bundesliga',
        name: 'Bundesliga',
        country: 'Germany',
        flag: '🇩🇪',
        leagueID: 14968,
      },
      {
        id: 'ligue1',
        name: 'Ligue 1',
        country: 'France',
        flag: '🇫🇷',
        leagueID: 14932,
      },
      {
        id: 'seriea',
        name: 'Serie A',
        country: 'Italy',
        flag: '🇮🇹',
        leagueID: 15068,
      },
    ],
  },
  {
    label: 'Rest of World',
    emoji: '🌏',
    leagues: [
      {
        id: 'j1-league',
        name: 'J1 League',
        country: 'Japan',
        flag: '🇯🇵',
        leagueID: 16242,
      },
      {
        id: 'superleague',
        name: 'Superleague',
        country: 'Greece',
        flag: '🇬🇷',
        leagueID: 16789,
      },
    ],
  },
];

// Generate the HTML content for the FootyStats widget
const generateWidgetHtml = (leagueID: number): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
        }
        #fs-standings {
          min-height: 420px;
        }
      </style>
    </head>
    <body>
      <div id="fs-standings"></div>
      <script>
        (function (w,d,s,o,f,js,fjs) {
          w['fsStandingsEmbed']=o;
          w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
          js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
          js.id = o;
          js.src = f;
          js.async = 1;
          if (fjs && fjs.parentNode) {
            fjs.parentNode.insertBefore(js, fjs);
          } else {
            d.body.appendChild(js);
          }
        }(window, document, 'script', 'mw', 'https://cdn.footystats.org/embeds/standings.js'));
        mw('params', { leagueID: ${leagueID} });
      </script>
    </body>
    </html>
  `;
};

const SportsLeagueTables = () => {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeLeagueId, setActiveLeagueId] = useState(LEAGUE_GROUPS[0].leagues[0].id);

  const activeGroup = LEAGUE_GROUPS[activeGroupIndex];
  const activeLeague = activeGroup.leagues.find((l) => l.id === activeLeagueId) || activeGroup.leagues[0];

  const handleGroupChange = (groupIndex: number) => {
    setActiveGroupIndex(groupIndex);
    setActiveLeagueId(LEAGUE_GROUPS[groupIndex].leagues[0].id);
  };

  const handleLeagueChange = (leagueId: string) => {
    setActiveLeagueId(leagueId);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-4 flex items-center gap-3">
        <span className="text-3xl">⚽</span>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Football League Tables</h2>
          <p className="text-green-100 text-sm flex items-center gap-1 mt-0.5">
            <Globe size={12} />
            Live standings from around the world
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
            Live Data
          </span>
        </div>
      </div>

      {/* Category Group Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 scrollbar-hide">
        {LEAGUE_GROUPS.map((group, index) => (
          <button
            key={group.label}
            onClick={() => handleGroupChange(index)}
            className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap ${
              index === activeGroupIndex
                ? 'border-green-600 text-green-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{group.emoji}</span>
            {group.label}
          </button>
        ))}
      </div>

      {/* League Tabs within selected group */}
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-white border-b border-gray-100">
        {activeGroup.leagues.map((league) => (
          <button
            key={league.id}
            onClick={() => handleLeagueChange(league.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              league.id === activeLeague.id
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="text-base leading-none">{league.flag}</span>
            {league.name}
          </button>
        ))}
      </div>

      {/* Active League Info Bar */}
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

      {/* Widget Area - Using iframe for isolation */}
      <div className="bg-white">
        <iframe
          key={activeLeague.leagueID}
          srcDoc={generateWidgetHtml(activeLeague.leagueID)}
          title={`${activeLeague.name} Standings`}
          className="w-full border-0"
          style={{ height: '600px' }}
          loading="lazy"
        />

      </div>

      {/* Attribution */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
        Live data by{' '}
        <a
          href="https://footystats.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-600 hover:underline font-medium"
        >
          FootyStats
        </a>
      </div>
    </div>
  );
};

export default SportsLeagueTables;
