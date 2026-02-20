import { useState, useEffect, useRef } from 'react';

// Type declarations for window properties
declare global {
  interface Window {
    monetag?: { queue: unknown[] };
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface LazyAdProps {
  adType?: 'banner' | 'sidebar' | 'inline' | 'sticky';
  className?: string;
  style?: React.CSSProperties;
  adId?: string;
  adSlot?: string;
  fallback?: React.ReactNode;
}

const LazyAd: React.FC<LazyAdProps> = ({ 
  adType = 'banner', 
  className, 
  style, 
  adId, 
  adSlot, 
  fallback 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only load ads when component is in viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    if (adRef.current) {
      observer.observe(adRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isInView) {
      // Load ad after a small delay to prevent blocking
      const timer = setTimeout(() => {
        setIsLoaded(true);

        // Initialize Monetag script for proper ad serving
        if (!window.monetag) {
          window.monetag = { queue: [] };
          const script = document.createElement('script');
          script.src = 'https://otieu.com/pop.js';
          script.async = true;
          
          // Add error handling for script loading
          script.onerror = () => {
            console.warn('Failed to load ad script from otieu.com');
          };
          
          try {
            document.head.appendChild(script);
          } catch (e) {
            console.warn('Error appending ad script:', e);
          }
        }

        // Initialize ad script if needed
        if (window.adsbygoogle && adType === 'banner') {
          try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          } catch (e) {
            console.warn('Ad loading failed:', e);
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isInView, adType]);

  // Ad content based on type
  const renderAdContent = () => {
    switch (adType) {
      case 'banner':
        return (
          <div
            className={`lazy-ad-banner ${className || ''}`}
            style={{
              ...style,
              minHeight: '90px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: '#6b7280'
            }}
          >
            {isLoaded ? (
              <div className="ad-content">
                <div className="ad-label" style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>
                  Advertisement
                </div>
                <a
                  href="https://otieu.com/4/10551313"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#374151' }}>
                    Trending Now 🔥
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Click for exclusive content
                  </div>
                </a>
              </div>
            ) : (
              <div className="ad-loading" style={{ color: '#9ca3af' }}>
                Loading ad...
              </div>
            )}
          </div>
        );

      case 'sidebar':
        return (
          <div 
            className={`lazy-ad-sidebar ${className || ''}`}
            style={{ 
              ...style,
              minHeight: '250px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {isLoaded ? (
              <div className="sidebar-ad-content">
                <div className="ad-label" style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Sponsored
                </div>
                <div style={{ fontWeight: 'bold', color: '#111827', marginBottom: '8px', fontSize: '14px' }}>
                  Premium Content
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                  Discover exclusive content and features available to premium subscribers.
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button 
                    style={{
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    onClick={() => window.open('https://example.com/premium', '_blank')}
                  >
                    Learn More
                  </button>
                </div>
              </div>
            ) : (
              <div className="ad-loading" style={{ color: '#9ca3af', textAlign: 'center' }}>
                <div style={{ marginBottom: '8px' }}>Loading sidebar ad...</div>
                <div style={{ height: '4px', width: '60%', backgroundColor: '#e5e7eb', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: '0%', backgroundColor: '#2563eb', transition: 'width 0.3s' }}></div>
                </div>
              </div>
            )}
          </div>
        );

      case 'inline':
        return (
          <div 
            className={`lazy-ad-inline ${className || ''}`}
            style={{ 
              ...style,
              minHeight: '120px',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              margin: '16px 0'
            }}
          >
            {isLoaded ? (
              <div className="inline-ad-content">
                <div className="ad-label" style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>
                  Sponsored Content
                </div>
                <div style={{ fontWeight: 'bold', color: '#111827', marginBottom: '6px', fontSize: '14px' }}>
                  Featured Partner
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4', marginBottom: '8px' }}>
                  Check out our partners for exclusive deals and content.
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '999px' }}>
                    Entertainment
                  </span>
                  <span style={{ fontSize: '11px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '999px' }}>
                    Lifestyle
                  </span>
                </div>
              </div>
            ) : (
              <div className="ad-loading" style={{ color: '#9ca3af', textAlign: 'center' }}>
                Loading inline ad...
              </div>
            )}
          </div>
        );

      case 'sticky':
        return (
          <div 
            className={`lazy-ad-sticky ${className || ''}`}
            style={{ 
              ...style,
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              width: '300px',
              minHeight: '120px',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              padding: '12px'
            }}
          >
            {isLoaded ? (
              <div className="sticky-ad-content">
                <div className="ad-label" style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>
                  Advertisement
                </div>
                <div style={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px', fontSize: '13px' }}>
                  Special Offer
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.3' }}>
                  Limited time offer available now.
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button 
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                    onClick={() => window.open('https://example.com/offer', '_blank')}
                  >
                    Claim Offer
                  </button>
                  <button 
                    style={{
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      const adElement = adRef.current;
                      if (adElement) {
                        adElement.style.display = 'none';
                      }
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="ad-loading" style={{ color: '#9ca3af', textAlign: 'center', padding: '8px' }}>
                Loading sticky ad...
              </div>
            )}
          </div>
        );

      default:
        return fallback || <div>Ad content</div>;
    }
  };

  return (
    <div ref={adRef} className="lazy-ad-container">
      {renderAdContent()}
    </div>
  );
};

export default LazyAd;
