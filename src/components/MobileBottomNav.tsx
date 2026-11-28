import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Home, Film, Bot, Sparkles, TrendingUp, User } from 'lucide-react';
import RealSSAChat from './RealSSAChat';

interface NavTab {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  path: string;
  matchPaths?: string[];
}

const tabs: NavTab[] = [
  { label: 'Home', icon: Home, path: '/', matchPaths: ['/'] },
  { label: 'Cinema', icon: Film, path: '/videos', matchPaths: ['/videos', '/cinema', '/movies', '/video-news', '/live-tv'] },
  { label: 'For You', icon: Sparkles, path: '/for-you', matchPaths: ['/for-you'] },
  { label: 'Trending', icon: TrendingUp, path: '/trending', matchPaths: ['/trending'] },
  { label: 'Profile', icon: User, path: '/profile', matchPaths: ['/profile', '/reading-list', '/reading-history', '/downloads', '/bookmarks'] },
];

const HIDDEN_ROUTES = [
  '/admin', '/browser', '/reels', '/wire', '/search', '/article',
  '/edit-news', '/admin-dashboard', '/internal', '/post-news',
  '/admin-login', '/verify-email', '/publisher', '/entity', '/market', '/events',
  '/widget', '/library', '/country', '/state', '/city',
  '/local-government', '/ads', '/download', '/login',
];

function Tab({ tab, active }: { tab: NavTab; active: boolean }) {
  return (
    <Link className="mobile-bottom-nav__item" to={tab.path}
      aria-current={active ? 'page' : undefined} data-active={active}>
      <span className="mobile-bottom-nav__icon" aria-hidden>
        <tab.icon size={21} strokeWidth={active ? 2.35 : 1.75} />
      </span>
      <span className="mobile-bottom-nav__label">{tab.label}</span>
    </Link>
  );
}

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  const isHidden = HIDDEN_ROUTES.some(r => (pathname === r || pathname.startsWith(`${r}/`)));

  const activeIndex = tabs.findIndex(tab =>
    tab.path === '/' ? pathname === '/' : tab.matchPaths?.some(p => pathname === p || pathname.startsWith(`${p}/`))
  );

  const indicatorSlot = activeIndex < 0 ? 0 : activeIndex < 2 ? activeIndex : activeIndex + 1;

  useEffect(() => { setChatOpen(false); }, [pathname]);

  if (isHidden) return null;

  return createPortal(
    <>
      <RealSSAChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav__items">
          {(activeIndex >= 0 || chatOpen) && (
            <span aria-hidden className="mobile-bottom-nav__indicator"
              style={{ transform: `translateX(${(chatOpen ? 2 : indicatorSlot) * 100}%)` }} />
          )}

          <Tab tab={tabs[0]} active={!chatOpen && activeIndex === 0} />
          <Tab tab={tabs[1]} active={!chatOpen && activeIndex === 1} />

          <button
            type="button"
            className="mobile-bottom-nav__item mobile-bottom-nav__assistant"
            onClick={() => setChatOpen(true)}
            aria-label="Open RealSSA Assistant"
            aria-expanded={chatOpen}
            data-active={chatOpen}
          >
            <span className="mobile-bottom-nav__icon" aria-hidden>
              <Bot size={22} strokeWidth={chatOpen ? 2.4 : 1.7} />
            </span>
            <span className="mobile-bottom-nav__label">Assistant</span>
          </button>

          <Tab tab={tabs[2]} active={!chatOpen && activeIndex === 2} />
          <Tab tab={tabs[3]} active={!chatOpen && activeIndex === 3} />
          <Tab tab={tabs[4]} active={!chatOpen && activeIndex === 4} />
        </div>
      </nav>
    </>,
    document.body
  );
};

export default MobileBottomNav;
