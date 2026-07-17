import { useEffect } from 'react';

interface ScoremerWidgetProps {
  className?: string;
}

const ScoremerWidget = ({ 
  className = ""
}: ScoremerWidgetProps) => {
  
  useEffect(() => {
    // Load Scorebat embed script
    const loadScript = () => {
      if (document.getElementById('scorebat-jssdk')) return;
      
      const js = document.createElement('script');
      js.id = 'scorebat-jssdk';
      js.src = 'https://www.scorebat.com/embed/embed.js?v=arrv';
      js.async = true;
      
      const fjs = document.getElementsByTagName('script')[0];
      if (fjs && fjs.parentNode) {
        fjs.parentNode.insertBefore(js, fjs);
      } else {
        document.body.appendChild(js);
      }
    };
    
    loadScript();
  }, []);

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
          <iframe 
            src="https://www.scorebat.com/embed/livescore/?token=Mjc3MzMxXzE3NzE1MzMzMjJfNGU5YmVkZmI0OTkyN2E3ZWMwNTRkMmY3MWI3YTRlNzQxYTU3MTljZA=="
            frameBorder="0"
            width="100%"
            height="760"
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{ width: '100%', height: '760px', overflow: 'hidden', display: 'block' }}
            title="Live Football Scores"
            className="_scorebatEmbeddedPlayer_"
          />
        </div>

      </div>
    </div>
  );
};

export default ScoremerWidget;
