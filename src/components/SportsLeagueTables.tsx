import { useState, useEffect, useRef } from 'react';
import { Globe, Trophy } from 'lucide-react';

interface League {
  id: string;
  name: string;
  country: string;
  flag: string;
  widgetId: string;
  widgetUrl: string;
}

interface LeagueGroup {
  label: string;
  emoji: string;
  leagues: League[];
}

const LEAGUE_GROUPS: LeagueGroup[] = [
  {
    label: 'African',
    emoji: '🌍',
    leagues: [
      {
        id: 'npfl',
        name: 'NPFL',
        country: 'Nigeria',
        flag: '🇳🇬',
        widgetId: 'widget-jvyjmlsdhqze',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232328281a87a6b7041ee10?widgetId=jvyjmlsdhqze&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'ghana-pl',
        name: 'Ghana Premier League',
        country: 'Ghana',
        flag: '🇬🇭',
        widgetId: 'widget-rznvmlsdgncg',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232373c075e5774a244b1ba?widgetId=rznvmlsdgncg&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'caf-cl',
        name: 'CAF Champions League',
        country: 'Africa',
        flag: '🌍',
        widgetId: 'widget-q4whmlsdcfj8',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232327b81a87a6b7041ed3a?widgetId=q4whmlsdcfj8&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'afcon',
        name: 'AFCON',
        country: 'Africa',
        flag: '🏆',
        widgetId: 'widget-lpyhmlsd79s2',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62327c7198b2e367f650e4d4?widgetId=lpyhmlsd79s2&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'wc-qual-caf',
        name: 'WC Qualification CAF',
        country: 'Africa',
        flag: '🌍',
        widgetId: 'widget-z0lhmlsdaj8g',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/623237858afe7e403066ced4?widgetId=z0lhmlsdaj8g&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
    ],
  },
  {
    label: 'European Cups',
    emoji: '🏆',
    leagues: [
      {
        id: 'ucl',
        name: 'Champions League',
        country: 'Europe',
        flag: '⭐',
        widgetId: 'widget-oingmlsce8u7',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232267fbf1fa71a67215dfc?widgetId=oingmlsce8u7&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'uel',
        name: 'Europa League',
        country: 'Europe',
        flag: '🟠',
        widgetId: 'widget-6vqbmlscfbio',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322bf0ea44793ec978b7a6?widgetId=6vqbmlscfbio&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'uecl',
        name: 'Conference League',
        country: 'Europe',
        flag: '🟢',
        widgetId: 'widget-g8f9mlscg4q6',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232378fe960277cec5c28b0?widgetId=g8f9mlscg4q6&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
    ],
  },
  {
    label: 'British',
    emoji: '🇬🇧',
    leagues: [
      {
        id: 'epl',
        name: 'Premier League',
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        widgetId: 'widget-y8v8mlscgyyw',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232265abf1fa71a672159ec?widgetId=y8v8mlscgyyw&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'fa-cup',
        name: 'FA Cup',
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        widgetId: 'widget-6v8nmlscrc85',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322dbb9062081f1515ee9c?widgetId=6v8nmlscrc85&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'welsh-pl',
        name: 'Welsh Premier League',
        country: 'Wales',
        flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
        widgetId: 'widget-t40rmlscxdzn',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232383faa372f03a16c7a4e?widgetId=t40rmlscxdzn&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'scottish',
        name: 'Scottish Premiership',
        country: 'Scotland',
        flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        widgetId: 'widget-s3ndmlscwonb',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322ba3946b336c466ab6f2?widgetId=s3ndmlscwonb&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
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
        widgetId: 'widget-6nw3mlschro2',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322c053617da0b83221cc6?widgetId=6nw3mlschro2&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'bundesliga',
        name: 'Bundesliga',
        country: 'Germany',
        flag: '🇩🇪',
        widgetId: 'widget-0oo3mlsckbby',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62321f50f7016c22d3650732?widgetId=0oo3mlsckbby&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'ligue1',
        name: 'Ligue 1',
        country: 'France',
        flag: '🇫🇷',
        widgetId: 'widget-t7scmlscq8hj',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322b4efd209951602c9096?widgetId=t7scmlscq8hj&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'seriea',
        name: 'Serie A',
        country: 'Italy',
        flag: '🇮🇹',
        widgetId: 'widget-43ilmlscqrvp',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322b827aee66235a2be718?widgetId=43ilmlscqrvp&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
    ],
  },
  {
    label: 'International',
    emoji: '🌐',
    leagues: [
      {
        id: 'world-cup',
        name: 'World Cup',
        country: 'International',
        flag: '🌍',
        widgetId: 'widget-q9xrmlsd0462',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322bfa75414360044d5ca4?widgetId=q9xrmlsd0462&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'nations-league',
        name: 'UEFA Nations League A',
        country: 'Europe',
        flag: '🇪🇺',
        widgetId: 'widget-wfn6mlsd0ymv',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232371247e10a66b322d10c?widgetId=wfn6mlsd0ymv&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'wc-qual-uefa',
        name: 'WC Qualification UEFA',
        country: 'Europe',
        flag: '🇪🇺',
        widgetId: 'widget-y3bbmlsd8rj7',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62323781eb82e258154aaeea?widgetId=y3bbmlsd8rj7&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'wc-qual-conmebol',
        name: 'WC Qualification CONMEBOL',
        country: 'South America',
        flag: '🌎',
        widgetId: 'widget-4ki9mlsd9xh2',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322af863d26f367f7a05ec?widgetId=4ki9mlsd9xh2&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
      {
        id: 'wc-qual-afc',
        name: 'WC Qualification AFC',
        country: 'Asia',
        flag: '🌏',
        widgetId: 'widget-zm2cmlsdbaeq',
        widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/623237838afe7e403066ceaa?widgetId=zm2cmlsdbaeq&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd',
      },
    ],
  },
];

const SportsLeagueTables = () => {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeLeagueId, setActiveLeagueId] = useState(LEAGUE_GROUPS[0].leagues[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  const activeGroup = LEAGUE_GROUPS[activeGroupIndex];
  const activeLeague = activeGroup.leagues.find((l) => l.id === activeLeagueId) || activeGroup.leagues[0];

  // Load the Scoreaxis widget script properly
  useEffect(() => {
    setIsLoading(true);

    // Remove previous script if any
    if (scriptRef.current && scriptRef.current.parentNode) {
      scriptRef.current.parentNode.removeChild(scriptRef.current);
      scriptRef.current = null;
    }

    // Clear the widget container content (keep attribution)
    const container = widgetContainerRef.current;
    if (!container) return;
    container.innerHTML = '';

    // Small delay to allow DOM to clear
    const timer = setTimeout(() => {
      // Set the container id to match the widgetId so Scoreaxis can find its wrapper
      container.id = activeLeague.widgetId;

      const script = document.createElement('script');
      script.src = activeLeague.widgetUrl;
      script.async = true;
      script.onload = () => setIsLoading(false);
      script.onerror = () => setIsLoading(false);
      container.appendChild(script);
      scriptRef.current = script;

      // Fallback: hide loader after 5s even if onload doesn't fire
      setTimeout(() => setIsLoading(false), 5000);
    }, 100);

    return () => clearTimeout(timer);
  }, [activeLeague.widgetUrl]);

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

      {/* Widget Area */}
      <div className="relative bg-white min-h-[300px]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 gap-3">
            <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500 font-medium">Loading {activeLeague.name} table...</p>
          </div>
        )}

        {/* Scoreaxis Widget Mount Point */}
        <div
          ref={widgetContainerRef}
          className="scoreaxis-widget w-full"
          style={{
            fontSize: '14px',
            backgroundColor: '#ffffff',
            color: '#141416',
            overflow: 'auto',
          }}
        />

        {/* Attribution */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
          Live data by{' '}
          <a
            href="https://www.scoreaxis.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:underline font-medium"
          >
            Scoreaxis
          </a>
        </div>
      </div>
    </div>
  );
};

export default SportsLeagueTables;
