import { useEffect, useRef } from 'react';

const ScoreAxisWidget = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // We add a script to handle dynamic height if ScoreAxis provides one, 
    // but the iframe itself is robust enough.
  }, []);

  return (
    // The container hides the bottom 28px of the iframe where the branding is located
    <div className="w-full relative overflow-hidden" style={{ height: '700px' }}>
      <iframe
        src="https://www.scoreaxis.com/widget/live-matches/0?autoHeight=0&links=0&color=%231e293b&inst=live-matches"
        width="100%"
        height="735" // Taller than container to push branding out of view
        className="absolute top-0 left-0 border-none bg-transparent"
        style={{ border: 'none' }}
        title="ScoreAxis Live Matches"
        loading="lazy"
      />
    </div>
  );
};

export default ScoreAxisWidget;
