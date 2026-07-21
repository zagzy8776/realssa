import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';
import ReelsCategoryColumn from '../components/ReelsCategoryColumn';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Swiper as SwiperClass } from 'swiper/types';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import 'swiper/css';

const CATEGORIES = [
  { id: 'trending',     name: 'For You',       path: '/api/articles' },
  { id: 'breaking',     name: 'Breaking',      path: '/api/news/breaking?diverse=true' },
  { id: 'local',        name: 'Local',         path: '/api/news/local' },
];

export default function Reels() {
  const navigate = useNavigate();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [swiperInstance, setSwiperInstance] = useState<SwiperClass | null>(null);
  const navRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setReelsStatusBar = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#000000' });
      } catch (err) {
        console.warn('Reels status bar configuration failed', err);
      }
    };

    setReelsStatusBar();

    return () => {
      // Trigger a class modification to fire useStatusBarSync's MutationObserver
      document.documentElement.classList.add('status-bar-sync-trigger');
      document.documentElement.classList.remove('status-bar-sync-trigger');
    };
  }, []);

  useEffect(() => {
    const activeEl = navRefs.current[activeCategoryIndex];
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [activeCategoryIndex]);

  const handleCategoryClick = (index: number) => {
    if (swiperInstance) {
      swiperInstance.slideTo(index);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Category Navigation Bar */}
      <div 
        className="absolute left-0 w-full z-50 flex items-center p-4 bg-gradient-to-b from-black/80 to-transparent"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 mr-2 z-50 text-white rounded-full bg-black/50 backdrop-blur-md">
          <ArrowLeft size={24} />
        </button>
        
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto hide-scrollbar flex space-x-8 px-4 items-center"
        >
          {CATEGORIES.map((cat, index) => (
            <button
              key={cat.id}
              ref={(el) => { navRefs.current[index] = el; }}
              onClick={() => handleCategoryClick(index)}
              className={`flex-shrink-0 whitespace-nowrap font-bold text-lg transition-all duration-300 ${
                activeCategoryIndex === index 
                  ? 'text-white scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' 
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Horizontal Swiper */}
      <Swiper
        className="w-full h-full"
        style={{ height: '100%' }}
        onSwiper={setSwiperInstance}
        onSlideChange={(swiper) => setActiveCategoryIndex(swiper.activeIndex)}
        initialSlide={activeCategoryIndex}
        resistanceRatio={0.85}
        slidesPerView={1}
        threshold={15}
        speed={400}
        shortSwipes={true}
        touchStartPreventDefault={false}
      >
        {CATEGORIES.map((cat, index) => {
          const isNeighbor = Math.abs(index - activeCategoryIndex) <= 1;
          return (
            <SwiperSlide key={cat.id} style={{ height: '100%' }}>
              <ErrorBoundary name={`ReelsCategoryColumn-${cat.id}`}>
                {isNeighbor ? (
                  <ReelsCategoryColumn
                    fetchUrl={apiUrl(cat.path)}
                    categoryName={cat.name}
                    isActive={activeCategoryIndex === index}
                  />
                ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </ErrorBoundary>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
