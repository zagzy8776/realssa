import { useEffect } from 'react';

interface ScorebatEmbedProps {
  token?: string;
  width?: string | number;
  height?: string | number;
  className?: string;
}

// Extend Window interface to include our custom property
declare global {
  interface Window {
    scorebatEmbedLoaded?: boolean;
  }
}

const ScorebatEmbed = ({ 
  token = "Mjc3MzMxXzE3NzE1MzMzMjJfNGU5YmVkZmI0OTkyN2E3ZWMwNTRkMmY3MWI3YTRlNzQxYTU3MTljZA==",
  width = "600",
  height = "760",
  className = ""
}: ScorebatEmbedProps) => {
  useEffect(() => {
    // Only load the script if it hasn't been loaded already
    if (typeof window !== 'undefined' && !window.scorebatEmbedLoaded) {
      const script = document.createElement('script');
      script.src = 'https://www.scorebat.com/embed/embed.js?v=arrv';
      script.async = true;
      script.id = 'scorebat-jssdk';
      
      document.body.appendChild(script);
      window.scorebatEmbedLoaded = true;

      // Clean up script on component unmount
      return () => {
        const existingScript = document.getElementById('scorebat-jssdk');
        if (existingScript) {
          existingScript.remove();
        }
        window.scorebatEmbedLoaded = false;
      };
    }
  }, []);

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
        
        <div className="border border-gray-200 rounded-lg overflow-hidden relative">
          <iframe 
            src={`https://www.scorebat.com/embed/livescore/?token=${token}`}
            frameBorder="0"
            width={width}
            height={height}
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{
              width: '100%',
              height: typeof height === 'number' ? `${height}px` : height,
              overflow: 'hidden',
              display: 'block'
            }}
            className="_scorebatEmbeddedPlayer_"
            title="Live Sports"
          />
        </div>
        
        {/* Removed "Powered by Scorebat" text to avoid their branding */}
      </div>
      
      {/* CSS to hide Scorebat branding elements */}
      <style>
        {`
          /* Hide Scorebat logo and branding inside the iframe */
          ._scorebatEmbeddedPlayer_ {
            position: relative;
          }
          
          /* Hide common Scorebat branding elements */
          ._scorebatEmbeddedPlayer_ .scorebat-logo,
          ._scorebatEmbeddedPlayer_ .scorebat-branding,
          ._scorebatEmbeddedPlayer_ .powered-by-scorebat,
          ._scorebatEmbeddedPlayer_ .scorebat-footer,
          ._scorebatEmbeddedPlayer_ [class*="scorebat"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }
          
          /* Hide Scorebat watermark or logo */
          ._scorebatEmbeddedPlayer_ img[src*="scorebat"],
          ._scorebatEmbeddedPlayer_ [src*="scorebat-logo"],
          ._scorebatEmbeddedPlayer_ .logo,
          ._scorebatEmbeddedPlayer_ .brand {
            display: none !important;
          }
          
          /* Hide any text containing "scorebat" */
          ._scorebatEmbeddedPlayer_ span:contains("Scorebat"),
          ._scorebatEmbeddedPlayer_ div:contains("scorebat"),
          ._scorebatEmbeddedPlayer_ p:contains("Scorebat") {
            display: none !important;
          }
        `}
      </style>
    </div>
  );
};

export default ScorebatEmbed;