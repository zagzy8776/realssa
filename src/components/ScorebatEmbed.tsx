import { useEffect, useState } from 'react';

interface ScorebatEmbedProps {
  token?: string;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const ScorebatEmbed = ({ 
  token = "Mjc3MzMxXzE3NzE1MzMzMjJfNGU5YmVkZmI0OTkyN2E3ZWMwNTRkMmY3MWI3YTRlNzQxYTU3MTljZA==",
  width = "100%",
  height = "760",
  className = ""
}: ScorebatEmbedProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load Scorebat embed script
  useEffect(() => {
    // Check if script is already loaded
    if (document.getElementById('scorebat-jssdk')) {
      setIsLoaded(true);
      return;
    }
    
    // Create and load the script
    const script = document.createElement('script');
    script.id = 'scorebat-jssdk';
    script.src = 'https://www.scorebat.com/embed/embed.js?v=arrv';
    script.async = true;
    
    script.onload = () => {
      setIsLoaded(true);
    };
    
    document.body.appendChild(script);
    
    return () => {
      // Don't remove script on unmount to prevent reloading issues
    };
  }, []);

  const embedUrl = `https://www.scorebat.com/embed/livescore/?token=${token}`;

  return (
    <div className={`scorebat-embed-container ${className}`}>
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            Live Sports Center
          </h3>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
            Live Now
          </span>
        </div>
        
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <iframe 
            src={embedUrl}
            frameBorder="0"
            width="100%"
            height={height}
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{
              width: '100%',
              height: '760px',
              overflow: 'hidden',
              display: 'block'
            }}
            title="Live Sports Scores"
          />
        </div>
      </div>
    </div>
  );
};

export default ScorebatEmbed;
