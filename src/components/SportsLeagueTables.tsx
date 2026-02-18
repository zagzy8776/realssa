import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Football, Globe, Trophy } from 'lucide-react';

// League interface
interface League {
  id: string;
  name: string;
  country: string;
  logo: string;
  widgetId: string;
  widgetUrl: string;
}

// League data
const LEAGUES: League[] = [
  // Top Tier European Leagues
  {
    id: 'epl',
    name: 'Premier League',
    country: 'England',
    logo: 'https://resources.premierleague.com/premierleague/badges/t3.png',
    widgetId: 'widget-i12hmls3aqaq',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232265abf1fa71a672159ec?widgetId=i12hmls3aqaq&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'laliga',
    name: 'La Liga',
    country: 'Spain',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0a/LaLiga_Santander_logo.svg/1200px-LaLiga_Santander_logo.svg.png',
    widgetId: 'widget-dl0mmls3rkz4',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232267fbf1fa71a67215dfc?widgetId=dl0mmls3rkz4&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'seriea',
    name: 'Serie A',
    country: 'Italy',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0b/Serie_A_logo.svg/1200px-Serie_A_logo.svg.png',
    widgetId: 'widget-r9m8mls3sdv6',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322bf0ea44793ec978b7a6?widgetId=r9m8mls3sdv6&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    country: 'Germany',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/Bundesliga_logo_%282017%29.svg/1200px-Bundesliga_logo_%282017%29.svg.png',
    widgetId: 'widget-mtekmls3swu4',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232378fe960277cec5c28b0?widgetId=mtekmls3swu4&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'ligue1',
    name: 'Ligue 1',
    country: 'France',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9a/Ligue_1_Logo.svg/1200px-Ligue_1_Logo.svg.png',
    widgetId: 'widget-hngwmls3tdka',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322c053617da0b83221cc6?widgetId=hngwmls3tdka&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  
  // International Competitions
  {
    id: 'champions',
    name: 'Champions League',
    country: 'Europe',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/67/UEFA_Champions_League.svg/1200px-UEFA_Champions_League.svg.png',
    widgetId: 'widget-geflmls3u5gk',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62321f50f7016c22d3650732?widgetId=geflmls3u5gk&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'europa',
    name: 'Europa League',
    country: 'Europe',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/UEFA_Europa_League.svg/1200px-UEFA_Europa_League.svg.png',
    widgetId: 'widget-1d6imls3umxe',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322b4efd209951602c9096?widgetId=1d6imls3umxe&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'conference',
    name: 'Conference League',
    country: 'Europe',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0b/UEFA_Europa_Conference_League.svg/1200px-UEFA_Europa_Conference_League.svg.png',
    widgetId: 'widget-d7phmls3v5e4',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322b827aee66235a2be718?widgetId=d7phmls3v5e4&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  
  // Other European Leagues
  {
    id: 'eredivisie',
    name: 'Eredivisie',
    country: 'Netherlands',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2d/Eredivisie_logo.svg/1200px-Eredivisie_logo.svg.png',
    widgetId: 'widget-cm28mls3vja4',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322dbb9062081f1515ee9c?widgetId=cm28mls3vja4&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'primeira',
    name: 'Primeira Liga',
    country: 'Portugal',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4d/Liga_Portugal_Logo.svg/1200px-Liga_Portugal_Logo.svg.png',
    widgetId: 'widget-aluqmls3wb67',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62327c6198b2e367f650e2c2?widgetId=aluqmls3wb67&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'scottish',
    name: 'Scottish Premiership',
    country: 'Scotland',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Scottish_Premiership_logo.svg/1200px-Scottish_Premiership_logo.svg.png',
    widgetId: 'widget-21dfmls3wpa2',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322ba3946b336c466ab6f2?widgetId=21dfmls3wpa2&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'belgian',
    name: 'Belgian Pro League',
    country: 'Belgium',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/Belgian_Pro_League_logo.svg/1200px-Belgian_Pro_League_logo.svg.png',
    widgetId: 'widget-e6hcmls3xts8',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/6232383faa372f03a16c7a4e?widgetId=e6hcmls3xts8&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  },
  {
    id: 'superlig',
    name: 'Süper Lig',
    country: 'Turkey',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0a/Super_Lig_logo.svg/1200px-Super_Lig_logo.svg.png',
    widgetId: 'widget-qrl5mls3ylia',
    widgetUrl: 'https://widgets.scoreaxis.com/api/football/league-table/62322ce38fd98d1a724b9bb4?widgetId=qrl5mls3ylia&lang=en&teamLogo=1&tableLines=1&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23ffffff&textColor=%23141416&linkColor=%23141416&borderColor=%23ecf1f7&tabColor=%23f3f8fd'
  }
];

const SportsLeagueTables = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll functionality
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTransitioning) {
        nextLeague();
      }
    }, 15000); // Change league every 15 seconds

    return () => clearInterval(interval);
  }, [currentIndex, isTransitioning]);

  const nextLeague = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setWidgetLoaded(false);
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % LEAGUES.length);
      setIsTransitioning(false);
      setWidgetLoaded(true);
    }, 300);
  };

  const prevLeague = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setWidgetLoaded(false);
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + LEAGUES.length) % LEAGUES.length);
      setIsTransitioning(false);
      setWidgetLoaded(true);
    }, 300);
  };

  const goToLeague = (index: number) => {
    if (index === currentIndex || isTransitioning) return;
    setIsTransitioning(true);
    setWidgetLoaded(false);
    
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
      setWidgetLoaded(true);
    }, 300);
  };

  const currentLeague = LEAGUES[currentIndex];

  return (
    <div className="bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 rounded-2xl p-6 mb-8 text-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Football size={32} className="text-green-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Football League Tables</h2>
            <p className="text-sm text-white/80 flex items-center gap-2 mt-1">
              <Globe size={14} />
              {currentLeague.country} • {currentLeague.name}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={prevLeague}
            disabled={isTransitioning}
            className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={nextLeague}
            disabled={isTransitioning}
            className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      {/* League Carousel */}
      <div className="mb-6 relative">
        <div 
          ref={containerRef}
          className="flex overflow-hidden gap-3 pb-2"
          style={{ 
            transform: `translateX(-${currentIndex * (100 / 5)}%)`,
            transition: isTransitioning ? 'transform 0.3s ease-in-out' : 'none'
          }}
        >
          {LEAGUES.map((league, index) => (
            <button
              key={league.id}
              onClick={() => goToLeague(index)}
              disabled={isTransitioning}
              className={`flex-shrink-0 w-1/5 p-3 rounded-xl transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-white text-green-700 shadow-lg scale-105'
                  : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
              } ${isTransitioning ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex flex-col items-center gap-2">
                <img
                  src={league.logo}
                  alt={league.name}
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Flat_tick_icon.svg/1200px-Flat_tick_icon.svg.png';
                  }}
                />
                <div className="text-center">
                  <p className="font-semibold text-sm truncate w-full">{league.name}</p>
                  <p className="text-xs opacity-80">{league.country}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        {/* Scroll indicators */}
        <div className="absolute top-0 left-0 w-10 h-full bg-gradient-to-r from-green-700 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-10 h-full bg-gradient-to-l from-green-700 to-transparent pointer-events-none" />
      </div>

      {/* Widget Container */}
      <div className="bg-white rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Trophy size={20} className="text-green-600" />
            <span className="font-bold text-gray-800">{currentLeague.name}</span>
            <span className="text-sm text-gray-500">({currentLeague.country})</span>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              Live Data
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
              Scoreaxis
            </span>
          </div>
        </div>
        
        <div 
          ref={widgetContainerRef}
          className="scoreaxis-widget"
          style={{
            width: 'auto',
            height: 'auto',
            fontSize: '14px',
            backgroundColor: '#ffffff',
            color: '#141416',
            border: '1px solid',
            borderColor: '#ecf1f7',
            overflow: 'auto'
          }}
        >
          {widgetLoaded && (
            <script
              src={currentLeague.widgetUrl}
              async
              onLoad={() => setWidgetLoaded(true)}
            />
          )}
          <div className="widget-main-link" style={{ padding: '6px 12px', fontWeight: 500 }}>
            Live data by <a href="https://www.scoreaxis.com/" style={{ color: 'inherit' }}>Scoreaxis</a>
          </div>
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {LEAGUES.map((_, index) => (
          <button
            key={index}
            onClick={() => goToLeague(index)}
            disabled={isTransitioning}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-white scale-125'
                : 'bg-white/50 hover:bg-white/75'
            } ${isTransitioning ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default SportsLeagueTables;