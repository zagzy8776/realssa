import { useState } from 'react';

interface ScoremerWidgetProps {
  leagues?: string;
  color?: string;
  lang?: string;
  height?: string;
  className?: string;
}

const ScoremerWidget = ({ 
  leagues = "35,36,37,38,39,117,128,1211",
  color = "50812f",
  lang = "en",
  height = "500px",
  className = ""
}: ScoremerWidgetProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);


  const widgetUrl = `https://www.scoremer.com/widgets/live?lid=${leagues}&c=${color}&f=FFF&lang=${lang}`;

  return (
    <div className={`scoremer-widget-container ${className}`}>
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            Live Football Scores
          </h3>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
            Live Now
          </span>
        </div>
        
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {hasError ? (
            <div 
              style={{ height: height }}
              className="flex items-center justify-center bg-gray-50 text-gray-500"
            >
              <div className="text-center p-4">
                <p className="text-sm">Unable to load live scores widget.</p>
                <p className="text-xs mt-2">Please check your connection or try again later.</p>
              </div>
            </div>
          ) : (
            <iframe 
              src={widgetUrl}
              style={{ height: height }}
              scrolling="auto"
              frameBorder="0"
              width="100%"
              title="Live Football Scores"
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default ScoremerWidget;
